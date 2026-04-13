const cloud = require("wx-server-sdk");
const { iai } = require("tencentcloud-sdk-nodejs");
const demoData = require("./demo-data.json");
const appConfig = require("./config.json");

const IaiClient = iai.v20200303.Client;

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 数据库集合名称配置
const COLLECTION_NAMES = {
  users: "users",
  persons: "persons",
  memories: "memories",
  healthRecords: "healthRecords",
  dailyTaskLogs: "daily_task_logs",
  bindingRequests: "binding_requests",
  elderUploads: "elder_uploads",
  memoryPairs: "memory_pairs",
  voiceMessages: "voice_messages",
  lifeGuides: "life_guides"
};

function toIsoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function getDateKey(value = new Date()) {
  return normalizeDateOnly(value);
}

function buildTaskSubtitle({ time, frequency, dosage } = {}) {
  return [time, frequency, dosage].filter(Boolean).join(" 路 ");
}

function getDateLabel(value) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return "";
  const [, month, day] = normalized.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function parseNumberValue(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 13 && digits.startsWith("86")) {
    return digits.slice(2);
  }
  if (digits.length === 11) {
    return digits;
  }
  return digits;
}

function maskPhone(phone) {
  const normalized = normalizePhone(phone);
  if (normalized.length !== 11) return normalized;
  return `${normalized.slice(0, 3)}****${normalized.slice(7)}`;
}

function getBindingRequestStatusText(status) {
  switch (status) {
    case "approved":
      return "已同意";
    case "rejected":
      return "已拒绝";
    default:
      return "审批中";
  }
}

const FACE_MODEL_VERSION = "3.0";
const DEFAULT_FACE_SCORE_THRESHOLD = 85;
const DEMO_ELDER_ID = "elder_demo_001";

function getMemoryPlaybackConfig() {
  const memoryPlayback = (appConfig && appConfig.memoryPlayback) || {};
  const bgmFileID = String(memoryPlayback.bgmFileID || "").trim();
  const bgmName = String(memoryPlayback.bgmName || "回忆背景音乐").trim() || "回忆背景音乐";

  return {
    success: true,
    enabled: Boolean(bgmFileID),
    bgmFileID,
    bgmName
  };
}

function getFaceRecognitionConfig() {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID || "";
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY || "";
  const region = process.env.TENCENTCLOUD_REGION || "ap-shanghai";
  const scoreThreshold = Number(process.env.FACE_SCORE_THRESHOLD || DEFAULT_FACE_SCORE_THRESHOLD);

  return {
    secretId,
    secretKey,
    region,
    scoreThreshold: Number.isFinite(scoreThreshold) ? scoreThreshold : DEFAULT_FACE_SCORE_THRESHOLD
  };
}

function assertFaceRecognitionConfigured() {
  const config = getFaceRecognitionConfig();
  if (!config.secretId || !config.secretKey) {
    throw new Error("请先在云函数环境变量中配置 TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY");
  }
  return config;
}

function createIaiClient() {
  const config = assertFaceRecognitionConfigured();
  return new IaiClient({
    credential: {
      secretId: config.secretId,
      secretKey: config.secretKey
    },
    region: config.region,
    profile: {
      signMethod: "TC3-HMAC-SHA256"
    }
  });
}

function sanitizeIaiId(prefix, rawValue) {
  const normalized = String(rawValue || "")
    .replace(/[^A-Za-z0-9\-_%@#&]/g, "_")
    .slice(0, 48);
  return `${prefix}_${normalized}`.slice(0, 64);
}

function getIaiGroupId(elderId) {
  return sanitizeIaiId("elder", elderId);
}

function getIaiPersonId(personId) {
  return sanitizeIaiId("person", personId);
}

function mapGenderToIai(gender) {
  if (gender === "男") return 1;
  if (gender === "女") return 2;
  return 0;
}

async function downloadCloudFileAsBase64(fileID) {
  if (!fileID) {
    throw new Error("缺少图片文件");
  }

  const downloadRes = await cloud.downloadFile({ fileID });
  const fileContent = downloadRes && downloadRes.fileContent;
  if (!fileContent) {
    throw new Error("图片下载失败");
  }

  return Buffer.from(fileContent).toString("base64");
}

async function ensureIaiGroup(client, elderId) {
  const groupId = getIaiGroupId(elderId);

  try {
    await client.GetGroupInfo({ GroupId: groupId });
    return groupId;
  } catch (_) {
    await client.CreateGroup({
      GroupId: groupId,
      GroupName: `家庭成员库-${String(elderId).slice(-6)}`,
      GroupExDescriptions: ["relation", "personId"],
      Tag: "elder-care-miniapp",
      FaceModelVersion: FACE_MODEL_VERSION
    });
    return groupId;
  }
}

async function removeIaiPersonIfExists(client, personId) {
  try {
    await client.DeletePerson({ PersonId: getIaiPersonId(personId) });
  } catch (_) {
    // Ignore not-found and cleanup failures here. Re-create will be attempted next.
  }
}

async function syncPersonFaceToIai(personDoc) {
  const facePhoto = personDoc && (personDoc.facePhoto || personDoc.avatar);
  if (!facePhoto) {
    return {
      synced: false,
      reason: "missing_face_photo"
    };
  }

  const client = createIaiClient();
  const groupId = await ensureIaiGroup(client, personDoc.elderId);
  const personId = getIaiPersonId(personDoc._id);
  const imageBase64 = await downloadCloudFileAsBase64(facePhoto);

  await removeIaiPersonIfExists(client, personDoc._id);

  await client.CreatePerson({
    GroupId: groupId,
    PersonName: personDoc.name || "未命名成员",
    PersonId: personId,
    Gender: mapGenderToIai(personDoc.gender),
    Image: imageBase64,
    FaceModelVersion: FACE_MODEL_VERSION,
    NeedRotateDetection: 1,
    PersonExDescriptionInfos: [
      {
        Desc: "relation",
        Value: personDoc.relation || ""
      },
      {
        Desc: "personId",
        Value: personDoc._id
      }
    ]
  });

  await db.collection(COLLECTION_NAMES.persons).doc(personDoc._id).update({
    data: {
      iaiGroupId: groupId,
      iaiPersonId: personId,
      faceSyncStatus: "synced",
      faceSyncedAt: new Date().toISOString(),
      faceSyncError: ""
    }
  });

  return {
    synced: true,
    groupId,
    personId
  };
}

async function markPersonFaceSyncFailed(personId, error) {
  const message = (error && error.message) || "人脸同步失败";

  await db.collection(COLLECTION_NAMES.persons).doc(personId).update({
    data: {
      faceSyncStatus: "failed",
      faceSyncError: message,
      faceSyncFailedAt: new Date().toISOString()
    }
  });

  return message;
}

/**
 * 确保集合存在
 */
async function ensureCollections() {
  const collectionNames = Object.values(COLLECTION_NAMES);

  for (const name of collectionNames) {
    try {
      await db.createCollection(name);
    } catch (error) {
      // collection already exists
    }
  }
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatMonthDay(dateStr) {
  try {
    // 优先解析纯日期字符串（YYYY-MM-DD），避免时区影响
    if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr.slice(5);
    }
    const base = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(base.getTime())) return null;
    // 以北京时间计算 MM-DD，彻底规避容器时区差异
    const shanghai = new Date(base.getTime() + 8 * 60 * 60 * 1000);
    return `${pad2(shanghai.getUTCMonth() + 1)}-${pad2(shanghai.getUTCDate())}`;
  } catch (_) {
    return null;
  }
}

function normalizeDateOnly(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    if (trimmed) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
      }
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  return "";
}

function getWeekdayNumber(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
}

function normalizeReminderWeekdays(value) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => item >= 1 && item <= 7)
    )
  ).sort((a, b) => a - b);
}

function normalizeReminderRule(input = {}, fallback = {}) {
  const reminderEnabled =
    input.reminderEnabled !== undefined ? !!input.reminderEnabled : !!fallback.reminderEnabled;
  const reminderTime = reminderEnabled
    ? String(
        input.reminderTime !== undefined ? input.reminderTime : fallback.reminderTime || ""
      ).trim()
    : "";

  let reminderScheduleType = String(
    input.reminderScheduleType !== undefined
      ? input.reminderScheduleType
      : fallback.reminderScheduleType || "daily"
  ).trim();

  if (!["daily", "once", "workday", "weekly"].includes(reminderScheduleType)) {
    reminderScheduleType = "daily";
  }

  let reminderDate = reminderEnabled
    ? normalizeDateOnly(
        input.reminderDate !== undefined ? input.reminderDate : fallback.reminderDate || ""
      )
    : "";
  let reminderWeekdays = reminderEnabled
    ? normalizeReminderWeekdays(
        input.reminderWeekdays !== undefined
          ? input.reminderWeekdays
          : fallback.reminderWeekdays
      )
    : [];

  if (!reminderEnabled) {
    reminderScheduleType = "daily";
    reminderDate = "";
    reminderWeekdays = [];
  } else if (reminderScheduleType === "once") {
    reminderDate = reminderDate || getDateKey(new Date());
    reminderWeekdays = [];
  } else if (reminderScheduleType === "weekly") {
    reminderWeekdays = reminderWeekdays.length ? reminderWeekdays : [getWeekdayNumber(new Date())];
    reminderDate = "";
  } else {
    reminderDate = "";
    reminderWeekdays = [];
  }

  return {
    reminderEnabled,
    reminderTime,
    reminderScheduleType,
    reminderDate,
    reminderWeekdays
  };
}

function isReminderActiveOnDate(item = {}, value = new Date()) {
  if (!item || !item.reminderEnabled || !item.reminderTime) {
    return false;
  }

  const dateKey = getDateKey(value);
  const weekday = getWeekdayNumber(value);
  const scheduleType = item.reminderScheduleType || "daily";

  switch (scheduleType) {
    case "once":
      return !!item.reminderDate && item.reminderDate === dateKey;
    case "workday":
      return weekday >= 1 && weekday <= 5;
    case "weekly": {
      const weekdays = normalizeReminderWeekdays(item.reminderWeekdays);
      return weekdays.includes(weekday);
    }
    default:
      return true;
  }
}

function resolveMemoryEventDate(event = {}) {
  const normalized = normalizeDateOnly(event.eventDate);
  if (normalized) {
    return normalized;
  }

  const year = Number.parseInt(event.year, 10);
  if (Number.isFinite(year)) {
    return `${year}-01-01`;
  }

  return normalizeDateOnly(new Date());
}

function resolveMemoryYear(eventDate, fallbackYear) {
  const fromDate = normalizeDateOnly(eventDate);
  if (fromDate) {
    return Number.parseInt(fromDate.slice(0, 4), 10);
  }

  const parsedYear = Number.parseInt(fallbackYear, 10);
  if (Number.isFinite(parsedYear)) {
    return parsedYear;
  }

  return new Date().getFullYear();
}

function normalizeMemoryPersonRole(role, person) {
  if (role === "self" || role === "family") {
    return role;
  }

  const normalizedPerson = (person || "").trim();
  if (["本人", "自己", "我"].includes(normalizedPerson)) {
    return "self";
  }

  return normalizedPerson ? "family" : "";
}

/**
 * 获取当前用户
 */
async function getCurrentUser() {
  const wxContext = cloud.getWXContext();
  const result = await db.collection(COLLECTION_NAMES.users).where({ openId: wxContext.OPENID }).get();

  if (!result.data.length) {
    throw new Error("用户不存在，请先登录");
  }

  return result.data[0];
}


function normalizeUserType(user) {
  return user && user.userType ? user.userType : "elder";
}

function isElderUser(user) {
  return normalizeUserType(user) === "elder";
}

async function getEffectiveElderId(user) {
  if (user.boundElderId) {
    return user.boundElderId;
  }

  const userType = normalizeUserType(user);
  if (userType === "family") {
    throw new Error("请先绑定老人");
  }
  return user._id;
}

async function resolveElderIdForEvent(user, event = {}) {
  const requestedElderId = event && event.elderId;
  const userType = normalizeUserType(user);

  if (userType === "family") {
    if (!user.boundElderId) {
      throw new Error("请先绑定老人");
    }
    return user.boundElderId;
  }

  if (!requestedElderId || requestedElderId === user._id) {
    return user._id;
  }

  throw new Error("无权访问其他老人数据");
}

async function getUserById(userId) {
  const result = await db.collection(COLLECTION_NAMES.users).doc(userId).get();
  return result.data;
}

/**
 * 登录 - 创建或获取用户
 */
async function login(event = {}) {
  await ensureCollections();

  const wxContext = cloud.getWXContext();
  const userCollection = db.collection(COLLECTION_NAMES.users);
  const role = event.role || "elder";

  // 查找已存在的用户
  const existingUser = await userCollection.where({ openId: wxContext.OPENID }).get();

  if (existingUser.data.length) {
    const user = existingUser.data[0];
    if (role && user.userType !== role) {
      await userCollection.doc(user._id).update({
        data: {
          userType: role
        }
      });
      user.userType = role;
    }
    return {
      token: `cloud-${wxContext.OPENID}`,
      userType: user.userType || role || "elder",
      userId: user._id,
      boundElderId: user.boundElderId || ""
    };
  }

  // 创建新用户 - 基础信息，无演示数据
  const addResult = await userCollection.add({
    data: {
      openId: wxContext.OPENID,
      name: "",
      avatar: "",
      age: null,
      phone: "",
      gender: "",
      userType: role || "elder",
      relation: "本人",
      healthStatus: {
        bloodPressure: "",
        heartRate: null,
        bloodSugar: ""
      },
      createdAt: new Date().toISOString()
    }
  });

  return {
    token: `cloud-${wxContext.OPENID}`,
    userType: role || "elder",
    userId: addResult._id,
    boundElderId: ""
  };
}
// ==================== 绑定老人相关 ====================

async function getElderList() {
  await ensureCollections();
  const result = await db.collection(COLLECTION_NAMES.users).get();
  const elders = result.data.filter((user) => isElderUser(user));

  return elders.map((user) => ({
    id: user._id,
    name: user.name || "未命名",
    avatar: user.avatar || "",
    age: user.age || null,
    gender: user.gender || ""
  }));
}

async function bindElder(event) {
  if (!event.elderId) {
    throw new Error("缺少 elderId");
  }

  const user = await getCurrentUser();
  if (normalizeUserType(user) !== "family") {
    throw new Error("只有家属可以绑定老人");
  }
  const elder = await getUserById(event.elderId);

  if (!elder || !isElderUser(elder)) {
    throw new Error("老人不存在");
  }

  if (user.boundElderId && user.boundElderId !== event.elderId) {
    throw new Error("当前账号已绑定其他老人，如需更换请先解除原绑定");
  }

  await db.collection(COLLECTION_NAMES.users).doc(user._id).update({
    data: {
      boundElderId: event.elderId,
      boundAt: new Date().toISOString()
    }
  });

  return { success: true };
}

async function getElderBindInfo(event = {}) {
  if (!event.elderId) {
    throw new Error("缺少老人ID");
  }

  const elder = await getUserById(event.elderId);
  if (!elder || !isElderUser(elder)) {
    throw new Error("老人不存在");
  }

  return {
    id: elder._id,
    name: elder.name || "未命名老人",
    age: elder.age || null,
    gender: elder.gender || "",
    avatar: elder.avatar || "",
    relation: "本人",
    phone: elder.phone || "",
    maskedPhone: maskPhone(elder.phone || "")
  };
}

async function getBindingQRCode(event = {}) {
  const user = await getCurrentUser();
  if (!isElderUser(user)) {
    throw new Error("只有老人账号可以生成绑定二维码");
  }

  if (user.bindQrCodeFileID && !event.forceRefresh) {
    return {
      success: true,
      fileID: user.bindQrCodeFileID,
      elderId: user._id
    };
  }

  const qrRes = await cloud.openapi.wxacode.getUnlimited({
    scene: `inviteElderId=${user._id}`,
    page: "pages/login/login",
    checkPath: false
  });

  const fileContent = qrRes && (qrRes.buffer || qrRes.resultBuffer || qrRes.result || qrRes.fileContent);
  if (!fileContent) {
    throw new Error("生成绑定二维码失败");
  }

  const uploadRes = await cloud.uploadFile({
    cloudPath: `binding-qrcodes/${user._id}.png`,
    fileContent: Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent)
  });

  await db.collection(COLLECTION_NAMES.users).doc(user._id).update({
    data: {
      bindQrCodeFileID: uploadRes.fileID,
      bindQrCodeUpdatedAt: new Date().toISOString()
    }
  });

  return {
    success: true,
    fileID: uploadRes.fileID,
    elderId: user._id
  };
}

async function findElderByPhone(event = {}) {
  const phone = normalizePhone(event.phone);
  if (!phone || phone.length !== 11) {
    throw new Error("请输入 11 位手机号");
  }

  const user = await getCurrentUser();
  if (normalizeUserType(user) !== "family") {
    throw new Error("只有家属可以查找老人");
  }

  await ensureCollections();

  const result = await db
    .collection(COLLECTION_NAMES.users)
    .where({
      userType: "elder",
      phone
    })
    .get();

  if (!result.data.length) {
    throw new Error("未找到对应的老人账号");
  }

  if (result.data.length > 1) {
    throw new Error("该手机号匹配到多个老人账号，请改用邀请链接绑定");
  }

  const elder = result.data[0];
  return {
    id: elder._id,
    name: elder.name || "未命名老人",
    age: elder.age || null,
    gender: elder.gender || "",
    avatar: elder.avatar || "",
    relation: "本人",
    phone,
    maskedPhone: maskPhone(phone)
  };
}

async function createBindingRequest(event = {}) {
  if (!event.elderId) {
    throw new Error("缺少老人ID");
  }

  const user = await getCurrentUser();
  if (normalizeUserType(user) !== "family") {
    throw new Error("只有家属可以发起绑定申请");
  }

  const elder = await getUserById(event.elderId);
  if (!elder || !isElderUser(elder)) {
    throw new Error("老人不存在");
  }

  if (user.boundElderId === elder._id) {
    return {
      success: true,
      alreadyBound: true,
      boundElderId: elder._id,
      status: "approved"
    };
  }

  if (user.boundElderId && user.boundElderId !== elder._id) {
    throw new Error("当前账号已绑定其他老人，如需更换请先解除原绑定");
  }

  const existing = await db
    .collection(COLLECTION_NAMES.bindingRequests)
    .where({
      elderId: elder._id,
      familyUserId: user._id,
      status: "pending"
    })
    .get();

  if (existing.data.length) {
    return {
      success: true,
      requestId: existing.data[0]._id,
      status: "pending",
      alreadyPending: true
    };
  }

  const now = toIsoDate();
  const result = await db.collection(COLLECTION_NAMES.bindingRequests).add({
    data: {
      elderId: elder._id,
      elderName: elder.name || "未命名老人",
      elderAvatar: elder.avatar || "",
      familyUserId: user._id,
      familyName: user.name || "家属",
      familyPhone: normalizePhone(user.phone || ""),
      familyAvatar: user.avatar || "",
      relation: event.relation || user.relation || "家属",
      status: "pending",
      source: event.source || "invite",
      createdAt: now,
      updatedAt: now
    }
  });

  return {
    success: true,
    requestId: result._id,
    status: "pending"
  };
}

async function getMyBindingRequests() {
  const user = await getCurrentUser();
  if (normalizeUserType(user) !== "family") {
    return [];
  }

  const result = await db
    .collection(COLLECTION_NAMES.bindingRequests)
    .where({ familyUserId: user._id })
    .get();

  const elderMap = {};
  for (const item of result.data) {
    if (item && item.elderId && !elderMap[item.elderId]) {
      elderMap[item.elderId] = await getUserById(item.elderId).catch(() => null);
    }
  }

  return result.data
    .slice()
    .sort((a, b) => `${b.updatedAt || b.createdAt || ""}`.localeCompare(`${a.updatedAt || a.createdAt || ""}`))
    .map((item) => ({
      id: item._id,
      elderId: item.elderId,
      elderName: item.elderName || (elderMap[item.elderId] && elderMap[item.elderId].name) || "未命名老人",
      elderAvatar: item.elderAvatar || (elderMap[item.elderId] && elderMap[item.elderId].avatar) || "",
      familyUserId: item.familyUserId,
      familyName: item.familyName || user.name || "家属",
      familyPhone: item.familyPhone || "",
      relation: item.relation || "家属",
      status: item.status || "pending",
      statusText: getBindingRequestStatusText(item.status),
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
      requestTime: item.createdAt || ""
    }));
}

async function getBindingRequests() {
  const user = await getCurrentUser();
  if (!isElderUser(user)) {
    throw new Error("只有老人可以查看绑定申请");
  }

  const result = await db
    .collection(COLLECTION_NAMES.bindingRequests)
    .where({ elderId: user._id })
    .get();

  return result.data
    .slice()
    .sort((a, b) => `${b.createdAt || ""}`.localeCompare(`${a.createdAt || ""}`))
    .map((item) => ({
      id: item._id,
      familyUserId: item.familyUserId,
      applicantName: item.familyName || "家属",
      name: item.familyName || "家属",
      avatar: item.familyAvatar || "",
      phone: item.familyPhone || "",
      relation: item.relation || "家属",
      status: item.status || "pending",
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
      requestTime: item.createdAt || "",
      statusText: getBindingRequestStatusText(item.status)
    }));
}

async function approveBindingRequest(event = {}) {
  if (!event.requestId) {
    throw new Error("缺少申请ID");
  }

  const user = await getCurrentUser();
  if (!isElderUser(user)) {
    throw new Error("只有老人可以审批绑定申请");
  }

  const requestRes = await db.collection(COLLECTION_NAMES.bindingRequests).doc(event.requestId).get();
  const request = requestRes.data;
  if (!request || request.elderId !== user._id) {
    throw new Error("申请不存在");
  }
  if (request.status === "approved") {
    return { success: true, alreadyApproved: true };
  }
  if (request.status && request.status !== "pending") {
    throw new Error("该申请已处理");
  }

  const familyUser = await getUserById(request.familyUserId);
  if (!familyUser) {
    throw new Error("申请人不存在");
  }
  if (familyUser.boundElderId && familyUser.boundElderId !== user._id) {
    throw new Error("该家属已绑定其他老人");
  }

  const now = toIsoDate();
  await db.collection(COLLECTION_NAMES.bindingRequests).doc(event.requestId).update({
    data: {
      status: "approved",
      updatedAt: now,
      approvedAt: now,
      approvedBy: user._id
    }
  });

  await db.collection(COLLECTION_NAMES.users).doc(request.familyUserId).update({
    data: {
      boundElderId: user._id,
      boundAt: now
    }
  });

  return { success: true };
}

async function rejectBindingRequest(event = {}) {
  if (!event.requestId) {
    throw new Error("缺少申请ID");
  }

  const user = await getCurrentUser();
  if (!isElderUser(user)) {
    throw new Error("只有老人可以审批绑定申请");
  }

  const requestRes = await db.collection(COLLECTION_NAMES.bindingRequests).doc(event.requestId).get();
  const request = requestRes.data;
  if (!request || request.elderId !== user._id) {
    throw new Error("申请不存在");
  }
  if (request.status === "rejected") {
    return { success: true, alreadyRejected: true };
  }
  if (request.status && request.status !== "pending") {
    throw new Error("该申请已处理");
  }

  await db.collection(COLLECTION_NAMES.bindingRequests).doc(event.requestId).update({
    data: {
      status: "rejected",
      updatedAt: toIsoDate(),
      rejectedAt: toIsoDate(),
      rejectedBy: user._id
    }
  });

  return { success: true };
}


async function getPersonList() {
  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);
  const result = await db.collection(COLLECTION_NAMES.persons).where({ elderId }).get();

  return result.data.map((person) => ({
    id: person._id,
    name: person.name,
    avatar: person.avatar,
    facePhoto: person.facePhoto || person.avatar || "",
    relation: person.relation,
    age: person.age,
    description: person.description
  }));
}

function buildTree(persons) {
  const nodeMap = new Map();
  const roots = [];

  // 关系映射：确定亲子关系
  const relationParentMap = {
    "祖父": null,      // 祖父是根节点
    "祖母": null,      // 祖母是根节点
    "父亲": ["祖父", "祖母"],  // 父亲的父母是祖父/祖母
    "母亲": null,
    "叔叔": ["祖父", "祖母"],  // 叔叔的父母是祖父/祖母
    "姑姑": ["祖父", "祖母"],
    "本人": ["父亲", "母亲"],  // 本人的父母
    "儿子": ["本人"],
    "女儿": ["本人"],
    "孙子": ["本人", "儿子"],
    "孙女": ["本人", "儿子"]
  };

  persons.forEach((person) => {
    nodeMap.set(person._id, {
      id: person._id,
      name: person.name,
      avatar: person.avatar,
      relation: person.relation,
      age: person.age,
      health: person.health || "未知",
      description: person.description,
      children: []
    });
  });

  // 建立亲子关系
  persons.forEach((person) => {
    const node = nodeMap.get(person._id);

    // 优先使用数据库中的 parentPersonId
    if (person.parentPersonId && nodeMap.has(person.parentPersonId)) {
      nodeMap.get(person.parentPersonId).children.push(node);
      return;
    }

    // 如果没有 parentPersonId，尝试根据关系推断
    const parentRelations = relationParentMap[person.relation];
    if (parentRelations && parentRelations.length > 0) {
      // 查找具有指定关系的成员
      for (const parentRelation of parentRelations) {
        const parent = persons.find(p => p.relation === parentRelation);
        if (parent && nodeMap.has(parent._id)) {
          nodeMap.get(parent._id).children.push(node);
          return;
        }
      }
    }

    // 没有父节点，作为根节点
    roots.push(node);
  });

  return roots;
}

async function getFamilyTree() {
  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);
  const result = await db.collection(COLLECTION_NAMES.persons).where({ elderId }).get();
  return buildTree(result.data);
}

async function getPersonDetail(event) {
  if (!event.personId) {
    throw new Error("缺少 personId");
  }

  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);
  const result = await db.collection(COLLECTION_NAMES.persons).doc(event.personId).get();
  const person = result.data;

  if (!person || person.elderId !== elderId) {
    throw new Error("人物不存在");
  }

  return {
    id: person._id,
    name: person.name,
    avatar: person.avatar,
    facePhoto: person.facePhoto || person.avatar || "",
    relation: person.relation,
    age: person.age,
    gender: person.gender,
    health: person.health || "",
    healthStatus: person.healthStatus,
    description: person.description,
    memories: person.memories || []
  };
}

async function getElderInfo(event = {}) {
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const elder = elderId === user._id ? user : await getUserById(elderId);

  if (!elder) {
    throw new Error("老人不存在");
  }

  return {
    id: elder._id,
    name: elder.name,
    avatar: elder.avatar,
    age: elder.age,
    phone: elder.phone || "",
    gender: elder.gender,
    relation: elder.relation,
    healthStatus: elder.healthStatus,
    birthYear: elder.birthYear || "",
    hometown: elder.hometown || "",
    address: elder.address || "",
    emergencyContactName: elder.emergencyContactName || "",
    emergencyContactPhone: elder.emergencyContactPhone || "",
    allergies: elder.allergies || "",
    medications: elder.medications || "",
    notes: elder.notes || ""
  };
}

async function updateElderInfo(event) {
  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);
  const updateData = { updatedAt: new Date().toISOString() };

  if (event.name !== undefined) updateData.name = event.name;
  if (event.avatar !== undefined) updateData.avatar = event.avatar;
  if (event.age !== undefined) updateData.age = event.age;
  if (event.phone !== undefined) updateData.phone = normalizePhone(event.phone);
  if (event.gender !== undefined) updateData.gender = event.gender;
  if (event.relation !== undefined) updateData.relation = event.relation;
  if (event.birthYear !== undefined) updateData.birthYear = event.birthYear;
  if (event.hometown !== undefined) updateData.hometown = event.hometown;
  if (event.address !== undefined) updateData.address = event.address;
  if (event.emergencyContactName !== undefined) updateData.emergencyContactName = event.emergencyContactName;
  if (event.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = event.emergencyContactPhone;
  if (event.allergies !== undefined) updateData.allergies = event.allergies;
  if (event.medications !== undefined) updateData.medications = event.medications;
  if (event.notes !== undefined) updateData.notes = event.notes;

  await db.collection(COLLECTION_NAMES.users).doc(elderId).update({
    data: updateData
  });

  return { success: true };
}

/**
 * 添加家庭成员
 */
async function addPerson(event) {
  if (!event.name) {
    throw new Error("姓名不能为空");
  }

  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);

  const result = await db.collection(COLLECTION_NAMES.persons).add({
    data: {
      elderId: elderId,
      name: event.name,
      avatar: event.avatar || "",
      facePhoto: event.facePhoto || event.avatar || "",
      relation: event.relation || "",
      age: event.age || null,
      gender: event.gender || "",
      health: event.health || "",
      description: event.description || "",
      parentPersonId: event.parentPersonId || null,
      healthStatus: event.healthStatus || {},
      memories: [],
      createdAt: new Date().toISOString()
    }
  });

  const personDoc = {
    _id: result._id,
    elderId,
    name: event.name,
    avatar: event.avatar || "",
    facePhoto: event.facePhoto || event.avatar || "",
    relation: event.relation || "",
    gender: event.gender || ""
  };

  let faceSyncWarning = "";
  if (personDoc.facePhoto) {
    try {
      await syncPersonFaceToIai(personDoc);
    } catch (error) {
      faceSyncWarning = await markPersonFaceSyncFailed(result._id, error);
    }
  }

  return { id: result._id, success: true, faceSyncWarning };
}

/**
 * 更新家庭成员信息
 */
async function updatePerson(event) {
  if (!event.personId) {
    throw new Error("缺少成员ID");
  }

  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);

  const person = await db.collection(COLLECTION_NAMES.persons).doc(event.personId).get();
  if (!person.data || person.data.elderId !== elderId) {
    throw new Error("成员不存在或无权限修改");
  }

  const updateData = { updatedAt: new Date().toISOString() };
  if (event.name !== undefined) updateData.name = event.name;
  if (event.avatar !== undefined) updateData.avatar = event.avatar;
  if (event.facePhoto !== undefined) {
    updateData.facePhoto = event.facePhoto;
  } else if (
    event.avatar !== undefined &&
    (!person.data.facePhoto || person.data.facePhoto === person.data.avatar)
  ) {
    updateData.facePhoto = event.avatar;
  }
  if (event.relation !== undefined) updateData.relation = event.relation;
  if (event.age !== undefined) updateData.age = event.age;
  if (event.gender !== undefined) updateData.gender = event.gender;
  if (event.health !== undefined) updateData.health = event.health;
  if (event.description !== undefined) updateData.description = event.description;
  if (event.parentPersonId !== undefined) updateData.parentPersonId = event.parentPersonId;
  if (event.healthStatus !== undefined) updateData.healthStatus = event.healthStatus;

  await db.collection(COLLECTION_NAMES.persons).doc(event.personId).update({
    data: updateData
  });

  const nextPerson = {
    ...person.data,
    ...updateData,
    _id: person.data._id || event.personId
  };

  const shouldSyncFace =
    nextPerson.facePhoto &&
    (
      event.facePhoto !== undefined ||
      event.avatar !== undefined ||
      event.name !== undefined ||
      event.gender !== undefined ||
      event.relation !== undefined
    );

  let faceSyncWarning = "";
  if (shouldSyncFace) {
    try {
      await syncPersonFaceToIai(nextPerson);
    } catch (error) {
      faceSyncWarning = await markPersonFaceSyncFailed(event.personId, error);
    }
  }

  return { success: true, faceSyncWarning };
}

/**
 * 删除家庭成员
 */
async function deletePerson(event) {
  if (!event.personId) {
    throw new Error("缺少成员ID");
  }

  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);

  const person = await db.collection(COLLECTION_NAMES.persons).doc(event.personId).get();
  if (!person.data || person.data.elderId !== elderId) {
    throw new Error("成员不存在或无权限删除");
  }

  try {
    const client = createIaiClient();
    await removeIaiPersonIfExists(client, event.personId);
  } catch (_) {
    // 数据库删除不应因为外部人脸库清理失败而中断。
  }

  await db.collection(COLLECTION_NAMES.persons).doc(event.personId).remove();

  return { success: true };
}

async function getMemories(event = {}) {
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  let query = { elderId };
  if (event.person) {
    query.person = event.person;
  }
  if (event.decade) {
    query.decade = event.decade;
  }
  if (event.type) {
    query.type = event.type;
  }

  const result = await db
    .collection(COLLECTION_NAMES.memories)
    .where(query)
    .orderBy("year", "asc")
    .get();

  return result.data.map((memory) => ({
    id: memory._id,
    year: memory.year,
    decade: memory.decade,
    type: memory.type,
    title: memory.title,
    img: memory.img,
    story: memory.story,
    person: memory.person,
    personRole: memory.personRole || "",
    eventDate: memory.eventDate || "",
    eventMonthDay: memory.eventMonthDay || "",
    createdAt: memory.createdAt
  }));
}

async function addMemory(event = {}) {
  if (!event.title || !event.story) {
    throw new Error("标题和故事内容不能为空");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  const eventDate = resolveMemoryEventDate(event);
  const year = resolveMemoryYear(eventDate, event.year);
  const decade = Math.floor(year / 10) % 100 + "0";
  const eventMonthDay = formatMonthDay(eventDate);
  const person = (event.person || "").trim();
  const personRole = normalizeMemoryPersonRole(event.personRole, person);

  const result = await db.collection(COLLECTION_NAMES.memories).add({
    data: {
      elderId: elderId,
      year: year,
      decade: decade,
      type: event.type || "daily",
      title: event.title,
      img: event.img || "",
      story: event.story,
      person,
      personRole,
      eventDate: eventDate,
      eventMonthDay: eventMonthDay,
      createdAt: new Date().toISOString()
    }
  });

  return {
    id: result._id,
    success: true
  };
}

async function updateMemory(event = {}) {
  if (!event.memoryId) {
    throw new Error("缺少记忆ID");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  const memory = await db.collection(COLLECTION_NAMES.memories).doc(event.memoryId).get();
  if (!memory.data || memory.data.elderId !== elderId) {
    throw new Error("记忆不存在或无权限修改");
  }

  const updateData = {};
  if (event.title !== undefined) updateData.title = event.title;
  if (event.story !== undefined) updateData.story = event.story;
  if (event.img !== undefined) updateData.img = event.img;
  if (event.person !== undefined) updateData.person = (event.person || "").trim();
  if (event.type !== undefined) updateData.type = event.type;
  if (event.person !== undefined || event.personRole !== undefined) {
    const nextPerson = event.person !== undefined ? event.person : memory.data.person;
    const nextRole = event.personRole !== undefined ? event.personRole : memory.data.personRole;
    updateData.personRole = normalizeMemoryPersonRole(nextRole, nextPerson);
  }
  if (event.eventDate !== undefined) {
    const eventDate = resolveMemoryEventDate(event);
    updateData.eventDate = eventDate;
    updateData.year = resolveMemoryYear(eventDate, event.year);
    updateData.decade = Math.floor(updateData.year / 10) % 100 + "0";
    const md = formatMonthDay(eventDate);
    if (md) updateData.eventMonthDay = md;
  } else if (event.year !== undefined) {
    updateData.year = resolveMemoryYear("", event.year);
    updateData.decade = Math.floor(updateData.year / 10) % 100 + "0";
  }
  updateData.updatedAt = new Date().toISOString();

  await db.collection(COLLECTION_NAMES.memories).doc(event.memoryId).update({
    data: updateData
  });

  return { success: true };
}

async function deleteMemory(event = {}) {
  if (!event.memoryId) {
    throw new Error("缺少记忆ID");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  const memory = await db.collection(COLLECTION_NAMES.memories).doc(event.memoryId).get();
  if (!memory.data || memory.data.elderId !== elderId) {
    throw new Error("记忆不存在或无权限删除");
  }

  await db.collection(COLLECTION_NAMES.memories).doc(event.memoryId).remove();

  return { success: true };
}

function parseBloodPressure(value) {
  const text = String(value || "").trim();
  const matched = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!matched) return { systolic: null, diastolic: null };
  return {
    systolic: Number.parseInt(matched[1], 10),
    diastolic: Number.parseInt(matched[2], 10)
  };
}

function parseHealthNumber(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function formatHealthLabel(date) {
  const normalized = normalizeDateOnly(date);
  return normalized ? normalized.slice(5) : "";
}

function formatTrendRecord(record = {}) {
  const pressure = parseBloodPressure(record.bloodPressure || "");
  const systolic = record.systolic !== undefined && record.systolic !== null ? Number(record.systolic) : pressure.systolic;
  const diastolic = record.diastolic !== undefined && record.diastolic !== null ? Number(record.diastolic) : pressure.diastolic;

  return {
    date: record.recordDate || record.dateKey || record.createdAt || "",
    dateKey: record.dateKey || normalizeDateOnly(record.recordDate || record.createdAt),
    label: record.label || getDateLabel(record.recordDate || record.dateKey || record.createdAt),
    bloodPressure: record.bloodPressure || (systolic !== null && diastolic !== null ? `${systolic}/${diastolic}` : ""),
    systolic,
    diastolic,
    heartRate: parseNumberValue(record.heartRate),
    bloodSugar: parseNumberValue(record.bloodSugar)
  };
}

function buildFallbackTrend(healthStatus = {}) {
  const item = formatTrendRecord({
    recordDate: getDateKey(),
    dateKey: getDateKey(),
    label: getDateLabel(getDateKey()),
    bloodPressure: healthStatus.bloodPressure || "",
    heartRate: healthStatus.heartRate,
    bloodSugar: healthStatus.bloodSugar,
    createdAt: toIsoDate()
  });

  return item.systolic !== null || item.diastolic !== null || item.heartRate !== null || item.bloodSugar !== null ? [item] : [];
}

function formatTrendRecord(record = {}) {
  const pressure = parseBloodPressure(record.bloodPressure || "");
  const systolic = record.systolic !== undefined && record.systolic !== null ? Number(record.systolic) : pressure.systolic;
  const diastolic = record.diastolic !== undefined && record.diastolic !== null ? Number(record.diastolic) : pressure.diastolic;

  return {
    date: record.recordDate || record.dateKey || record.createdAt || "",
    dateKey: record.dateKey || normalizeDateOnly(record.recordDate || record.createdAt),
    label: record.label || getDateLabel(record.recordDate || record.dateKey || record.createdAt),
    bloodPressure: record.bloodPressure || (systolic !== null && diastolic !== null ? `${systolic}/${diastolic}` : ""),
    systolic,
    diastolic,
    heartRate: parseNumberValue(record.heartRate),
    bloodSugar: parseNumberValue(record.bloodSugar)
  };
}

function buildFallbackTrend(healthStatus = {}) {
  const item = formatTrendRecord({
    recordDate: getDateKey(),
    dateKey: getDateKey(),
    label: getDateLabel(getDateKey()),
    bloodPressure: healthStatus.bloodPressure || "",
    heartRate: healthStatus.heartRate,
    bloodSugar: healthStatus.bloodSugar,
    createdAt: toIsoDate()
  });

  return item.systolic !== null || item.diastolic !== null || item.heartRate !== null || item.bloodSugar !== null
    ? [item]
    : [];
}

function getHealthAlerts(measurement = {}) {
  const alerts = [];
  const pressure = parseBloodPressure(measurement.bloodPressure);
  const heartRate = parseHealthNumber(measurement.heartRate);
  const bloodSugar = parseHealthNumber(measurement.bloodSugar);

  if (pressure.systolic && pressure.diastolic) {
    if (pressure.systolic >= 140 || pressure.diastolic >= 90) {
      alerts.push({ metric: "bloodPressure", level: "high", text: "血压偏高，请留意休息和复测" });
    } else if (pressure.systolic < 90 || pressure.diastolic < 60) {
      alerts.push({ metric: "bloodPressure", level: "low", text: "血压偏低，请关注头晕乏力情况" });
    }
  }

  if (heartRate !== null) {
    if (heartRate > 100) {
      alerts.push({ metric: "heartRate", level: "high", text: "心率偏快，建议安静休息后复测" });
    } else if (heartRate < 50) {
      alerts.push({ metric: "heartRate", level: "low", text: "心率偏慢，如有不适请尽快关注" });
    }
  }

  if (bloodSugar !== null) {
    if (bloodSugar > 7.8) {
      alerts.push({ metric: "bloodSugar", level: "high", text: "血糖偏高，建议关注饮食和后续复测" });
    } else if (bloodSugar < 3.9) {
      alerts.push({ metric: "bloodSugar", level: "low", text: "血糖偏低，请及时补充食物并观察状态" });
    }
  }

  return alerts;
}

function pickLatestHealthMeasurement(records = []) {
  if (!records.length) return null;
  return records
    .slice()
    .sort((a, b) => {
      const aKey = `${a.recordDate || ""}-${a.createdAt || ""}`;
      const bKey = `${b.recordDate || ""}-${b.createdAt || ""}`;
      return bKey.localeCompare(aKey);
    })[0];
}

function buildHealthTrend(records = []) {
  const byDate = new Map();

  records.forEach((item) => {
    const date = normalizeDateOnly(item.recordDate || item.createdAt);
    if (!date) return;
    const existing = byDate.get(date);
    const currentKey = `${date}-${item.createdAt || ""}`;
    const existingKey = existing ? `${date}-${existing.createdAt || ""}` : "";
    if (!existing || currentKey > existingKey) {
      byDate.set(date, item);
    }
  });

  const latestSeven = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .reverse()
    .map(([, item]) => item);

  return {
    bloodPressure: latestSeven
      .map((item) => {
        const pressure = parseBloodPressure(item.bloodPressure);
        if (!pressure.systolic || !pressure.diastolic) return null;
        return {
          date: item.recordDate || "",
          label: formatHealthLabel(item.recordDate || item.createdAt),
          systolic: pressure.systolic,
          diastolic: pressure.diastolic
        };
      })
      .filter(Boolean),
    bloodSugar: latestSeven
      .map((item) => {
        const value = parseHealthNumber(item.bloodSugar);
        if (value === null) return null;
        return {
          date: item.recordDate || "",
          label: formatHealthLabel(item.recordDate || item.createdAt),
          value
        };
      })
      .filter(Boolean),
    heartRate: latestSeven
      .map((item) => {
        const value = parseHealthNumber(item.heartRate);
        if (value === null) return null;
        return {
          date: item.recordDate || "",
          label: formatHealthLabel(item.recordDate || item.createdAt),
          value
        };
      })
      .filter(Boolean)
  };
}

async function getHealthInfo(event = {}) {
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const elder = elderId === user._id ? user : await getUserById(elderId);

  const historyResult = await db
    .collection(COLLECTION_NAMES.healthRecords)
    .where({ elderId, type: "medicalHistory" })
    .get();

  const medicationResult = await db
    .collection(COLLECTION_NAMES.healthRecords)
    .where({ elderId, type: "medication" })
    .get();

  const measurementResult = await db
    .collection(COLLECTION_NAMES.healthRecords)
    .where({ elderId, type: "dailyHealth" })
    .get();

  const measurements = measurementResult.data || [];
  const latestMeasurement = pickLatestHealthMeasurement(measurements);
  const currentHealth = (elder && elder.healthStatus) || {};
  const todayHealth = {
    bloodPressure: currentHealth.bloodPressure || (latestMeasurement && latestMeasurement.bloodPressure) || "",
    heartRate: currentHealth.heartRate || (latestMeasurement && latestMeasurement.heartRate) || null,
    bloodSugar: currentHealth.bloodSugar || (latestMeasurement && latestMeasurement.bloodSugar) || ""
  };
  const formattedTrend = measurements
    .slice()
    .sort((a, b) => `${a.dateKey || a.recordDate || a.createdAt || ""}`.localeCompare(`${b.dateKey || b.recordDate || b.createdAt || ""}`))
    .map(formatTrendRecord)
    .filter((item) => item.systolic !== null || item.diastolic !== null || item.heartRate !== null || item.bloodSugar !== null);
  const healthTrend = formattedTrend.length ? formattedTrend.slice(-7) : buildFallbackTrend(currentHealth);
  const healthAlerts = getHealthAlerts({
    bloodPressure: todayHealth.bloodPressure,
    heartRate: todayHealth.heartRate,
    bloodSugar: todayHealth.bloodSugar
  });

  return {
    todayHealth,
    latestMeasurement: latestMeasurement
      ? {
          id: latestMeasurement._id,
          recordDate: latestMeasurement.recordDate || "",
          bloodPressure: latestMeasurement.bloodPressure || "",
          heartRate: latestMeasurement.heartRate || null,
          bloodSugar: latestMeasurement.bloodSugar || "",
          notes: latestMeasurement.notes || "",
          recorderRole: latestMeasurement.recorderRole || "",
          createdAt: latestMeasurement.createdAt || ""
        }
      : null,
    healthTrend,
    healthAlerts,
    measurementHistory: measurements
      .slice()
      .sort((a, b) => {
        const aKey = `${a.recordDate || ""}-${a.createdAt || ""}`;
        const bKey = `${b.recordDate || ""}-${b.createdAt || ""}`;
        return bKey.localeCompare(aKey);
      })
      .map((item) => ({
        id: item._id,
        recordDate: item.recordDate || "",
        bloodPressure: item.bloodPressure || "",
        heartRate: item.heartRate || null,
        bloodSugar: item.bloodSugar || "",
        notes: item.notes || "",
        recorderRole: item.recorderRole || "",
        createdAt: item.createdAt || ""
      })),
    medicalHistory: historyResult.data.map((item) => ({
      id: item._id,
      name: item.name,
      diagnoseYear: item.diagnoseYear,
      notes: item.notes
    })),
    medications: medicationResult.data.map((item) => ({
      id: item._id,
      name: item.name,
      frequency: item.frequency,
      dosage: item.dosage,
      time: item.time,
      notes: item.notes,
      reminderEnabled: !!item.reminderEnabled,
      reminderTime: item.reminderTime || "",
      reminderScheduleType: item.reminderScheduleType || "daily",
      reminderDate: item.reminderDate || "",
      reminderWeekdays: normalizeReminderWeekdays(item.reminderWeekdays),
      activeToday: isReminderActiveOnDate(item)
    }))
  };
}

async function getTodayCompletedTasks(event = {}) {
  await ensureCollections();

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const dateKey = getDateKey(event.dateKey || new Date());

  const res = await db
    .collection(COLLECTION_NAMES.dailyTaskLogs)
    .where({ elderId, dateKey })
    .get();

  return {
    dateKey,
    items: (res.data || [])
      .slice()
      .sort((a, b) => `${b.completedAt || ""}`.localeCompare(`${a.completedAt || ""}`))
      .map((item) => ({
      id: item._id,
      taskType: item.taskType || "",
      taskId: item.taskId || "",
      title: item.title || "",
      subtitle: item.subtitle || "",
      time: item.time || "",
      frequency: item.frequency || "",
      dosage: item.dosage || "",
      notes: item.notes || "",
      completedAt: item.completedAt || "",
      completedByRole: item.completedByRole || ""
    }))
  };
}

async function completeTodayTask(event = {}) {
  await ensureCollections();

  const user = await getCurrentUser();
  if (normalizeUserType(user) !== "elder") {
    throw new Error("只有老人本人可以标记完成");
  }

  const elderId = await resolveElderIdForEvent(user, event);
  const taskType = String(event.taskType || "medication").trim();
  const taskId = String(event.taskId || "").trim();
  const dateKey = getDateKey(event.dateKey || new Date());

  if (!taskId) {
    throw new Error("缺少提醒ID");
  }

  if (taskType !== "medication") {
    throw new Error("暂时只支持用药提醒");
  }

  const taskRes = await db.collection(COLLECTION_NAMES.healthRecords).doc(taskId).get();
  const task = taskRes.data;

  if (!task || task.elderId !== elderId || task.type !== "medication") {
    throw new Error("提醒不存在");
  }

  const existing = await db
    .collection(COLLECTION_NAMES.dailyTaskLogs)
    .where({ elderId, dateKey, taskType, taskId })
    .get();

  if (existing.data && existing.data.length) {
    return {
      success: true,
      id: existing.data[0]._id,
      duplicated: true
    };
  }

  const completedAt = new Date().toISOString();
  const title = task.name || "今日提醒";
  const subtitle = buildTaskSubtitle(task);

  const res = await db.collection(COLLECTION_NAMES.dailyTaskLogs).add({
    data: {
      elderId,
      dateKey,
      taskType,
      taskId,
      title,
      subtitle,
      time: task.time || "",
      frequency: task.frequency || "",
      dosage: task.dosage || "",
      notes: task.notes || "",
      completedAt,
      completedBy: user._id,
      completedByRole: normalizeUserType(user)
    }
  });

  return {
    success: true,
    id: res._id,
    item: {
      id: res._id,
      taskType,
      taskId,
      title,
      subtitle,
      time: task.time || "",
      frequency: task.frequency || "",
      dosage: task.dosage || "",
      notes: task.notes || "",
      completedAt
    }
  };
}

async function addMedicalHistory(event = {}) {
  if (!event.name) {
    throw new Error("病史名称不能为空");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  const result = await db.collection(COLLECTION_NAMES.healthRecords).add({
    data: {
      elderId,
      type: "medicalHistory",
      name: event.name,
      diagnoseYear: event.diagnoseYear || new Date().getFullYear(),
      notes: event.notes || "",
      createdAt: new Date().toISOString()
    }
  });

  return { id: result._id, success: true };
}

async function addMedication(event = {}) {
  if (!event.name) {
    throw new Error("药物名称不能为空");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  const result = await db.collection(COLLECTION_NAMES.healthRecords).add({
    data: {
      elderId,
      type: "medication",
      name: event.name,
      frequency: event.frequency || "",
      dosage: event.dosage || "",
      time: event.time || "",
      notes: event.notes || "",
      reminderEnabled: !!event.reminderEnabled,
      reminderTime: event.reminderEnabled ? (event.reminderTime || "") : "",
      createdAt: new Date().toISOString()
    }
  });

  return { id: result._id, success: true };
}

async function addHealthMeasurement(event = {}) {
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const recordDate = normalizeDateOnly(event.recordDate) || normalizeDateOnly(new Date());
  const bloodPressure = (event.bloodPressure || "").trim();
  const heartRate = event.heartRate === undefined || event.heartRate === null || event.heartRate === ""
    ? null
    : Number.parseInt(event.heartRate, 10);
  const bloodSugar = event.bloodSugar === undefined || event.bloodSugar === null
    ? ""
    : String(event.bloodSugar).trim();
  const notes = (event.notes || "").trim();

  if (!bloodPressure && !Number.isFinite(heartRate) && !bloodSugar) {
    throw new Error("请至少填写一项健康数据");
  }

  const result = await db.collection(COLLECTION_NAMES.healthRecords).add({
    data: {
      elderId,
      type: "dailyHealth",
      recordDate,
      bloodPressure,
      heartRate: Number.isFinite(heartRate) ? heartRate : null,
      bloodSugar,
      notes,
      recorderRole: normalizeUserType(user),
      createdAt: new Date().toISOString()
    }
  });

  const today = normalizeDateOnly(new Date());
  if (recordDate === today) {
    const updateData = {};
    if (bloodPressure) updateData["healthStatus.bloodPressure"] = bloodPressure;
    if (Number.isFinite(heartRate)) updateData["healthStatus.heartRate"] = heartRate;
    if (bloodSugar) updateData["healthStatus.bloodSugar"] = bloodSugar;

    if (Object.keys(updateData).length > 0) {
      await db.collection(COLLECTION_NAMES.users).doc(elderId).update({
        data: updateData
      });
    }
  }

  return { id: result._id, success: true };
}

async function updateTodayHealth(event = {}) {
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  const updateData = {};
  if (event.bloodPressure !== undefined) updateData["healthStatus.bloodPressure"] = event.bloodPressure;
  if (event.heartRate !== undefined) updateData["healthStatus.heartRate"] = event.heartRate;
  if (event.bloodSugar !== undefined) updateData["healthStatus.bloodSugar"] = event.bloodSugar;

  if (Object.keys(updateData).length > 0) {
    await db.collection(COLLECTION_NAMES.users).doc(elderId).update({
      data: updateData
    });

    const todayKey = getDateKey();
    const now = toIsoDate();
    const bloodPressure = event.bloodPressure !== undefined ? String(event.bloodPressure || "").trim() : "";
    const parsedPressure = parseBloodPressure(bloodPressure);
    const heartRate = event.heartRate !== undefined ? parseNumberValue(event.heartRate) : null;
    const bloodSugar = event.bloodSugar !== undefined ? String(event.bloodSugar || "").trim() : "";
    const existing = await db
      .collection(COLLECTION_NAMES.healthRecords)
      .where({ elderId, type: "dailyHealth", dateKey: todayKey })
      .get();

    const trendPayload = {
      elderId,
      type: "dailyHealth",
      recordDate: todayKey,
      dateKey: todayKey,
      label: getDateLabel(todayKey),
      bloodPressure,
      systolic: parsedPressure.systolic,
      diastolic: parsedPressure.diastolic,
      heartRate,
      bloodSugar,
      recorderRole: normalizeUserType(user),
      updatedAt: now
    };

    if (existing.data.length) {
      await db.collection(COLLECTION_NAMES.healthRecords).doc(existing.data[0]._id).update({
        data: trendPayload
      });
    } else {
      await db.collection(COLLECTION_NAMES.healthRecords).add({
        data: {
          ...trendPayload,
          createdAt: now
        }
      });
    }
  }

  return { success: true };
}

async function deleteHealthRecord(event = {}) {
  if (!event.recordId) {
    throw new Error("缺少记录ID");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  const record = await db.collection(COLLECTION_NAMES.healthRecords).doc(event.recordId).get();
  if (!record.data || record.data.elderId !== elderId) {
    throw new Error("记录不存在或无权限删除");
  }

  await db.collection(COLLECTION_NAMES.healthRecords).doc(event.recordId).remove();

  return { success: true };
}

// ==================== 老人端上传与“历史上的今天” ====================

async function addElderUpload(event = {}) {
  await ensureCollections();
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  const uploadType = event.type || (event.fileID ? "image" : "text");
  if (uploadType === "text" && !event.content) {
    throw new Error("缺少文本内容");
  }

  const record = {
    elderId,
    type: uploadType,
    img: uploadType === "image" ? (event.fileID || "") : "",
    content: uploadType === "text" ? (event.content || "") : "",
    eventDate: event.eventDate || new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  // 若前端已给定 eventMonthDay（基于选择的 YYYY-MM-DD），优先使用；否则按北京时区推导
  record.eventMonthDay = event.eventMonthDay || formatMonthDay(record.eventDate);

  const res = await db.collection(COLLECTION_NAMES.elderUploads).add({ data: record });
  return { id: res._id, success: true };
}

async function getElderUploads(event = {}) {
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const res = await db
    .collection(COLLECTION_NAMES.elderUploads)
    .where({ elderId })
    .orderBy("createdAt", "desc")
    .get();
  return res.data.map(item => ({
    id: item._id,
    type: item.type,
    img: item.img || "",
    content: item.content || "",
    eventDate: item.eventDate || "",
    eventMonthDay: item.eventMonthDay || "",
    createdAt: item.createdAt
  }));
}

async function getOnThisDayMemory(event = {}) {
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const monthDay = formatMonthDay();

  const [mRes, uRes] = await Promise.all([
    db.collection(COLLECTION_NAMES.memories).where({ elderId, eventMonthDay: monthDay }).get(),
    db.collection(COLLECTION_NAMES.elderUploads).where({ elderId, eventMonthDay: monthDay }).get()
  ]);

  const candidates = [];
  for (const m of mRes.data) {
    candidates.push({
      source: "memory",
      id: m._id,
      title: m.title || "",
      img: m.img || "",
      content: m.story || "",
      eventDate: m.eventDate || "",
      eventMonthDay: m.eventMonthDay || ""
    });
  }
  for (const u of uRes.data) {
    candidates.push({
      source: "elder_upload",
      id: u._id,
      title: "",
      img: u.type === "image" ? (u.img || "") : "",
      content: u.type === "text" ? (u.content || "") : "",
      eventDate: u.eventDate || "",
      eventMonthDay: u.eventMonthDay || ""
    });
  }

  if (!candidates.length) return null;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return picked;
}

// ==================== 配对素材 ====================

function normalizeLifeGuideSteps(steps = [], fallback = {}) {
  if (Array.isArray(steps) && steps.length) {
    return steps
      .map((step, index) => ({
        image: typeof step.image === "string" ? step.image.trim() : "",
        text: typeof step.text === "string" ? step.text.trim() : "",
        order: Number.isFinite(step.order) ? step.order : index
      }))
      .filter((step) => step.image || step.text);
  }

  const legacyImage = typeof fallback.coverImage === "string" ? fallback.coverImage.trim() : "";
  const legacyText = typeof fallback.content === "string" ? fallback.content.trim() : "";
  if (!legacyImage && !legacyText) {
    return [];
  }

  return [
    {
      image: legacyImage,
      text: legacyText,
      order: 0
    }
  ];
}

function mapLifeGuideItem(item) {
  const steps = normalizeLifeGuideSteps(item.steps, item);
  const firstStep = steps[0] || {};
  return {
    id: item._id,
    title: item.title || "",
    itemName: item.itemName || "",
    coverImage: firstStep.image || "",
    content: firstStep.text || "",
    steps,
    stepCount: steps.length,
    videoFileID: item.videoFileID || "",
    hasVideo: !!item.videoFileID,
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || item.createdAt || ""
  };
}

async function getLifeGuides(event = {}) {
  await ensureCollections();

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const res = await db
    .collection(COLLECTION_NAMES.lifeGuides)
    .where({ elderId })
    .orderBy("updatedAt", "desc")
    .get();

  return (res.data || []).map(mapLifeGuideItem);
}

async function getLifeGuideDetail(event = {}) {
  if (!event.guideId) {
    throw new Error("缺少教程ID");
  }

  await ensureCollections();

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const res = await db.collection(COLLECTION_NAMES.lifeGuides).doc(event.guideId).get();
  const guide = res.data;

  if (!guide || guide.elderId !== elderId) {
    throw new Error("教程不存在或无权访问");
  }

  return mapLifeGuideItem(guide);
}

async function addLifeGuide(event = {}) {
  if (!event.title) {
    throw new Error("教程标题不能为空");
  }
  if (!event.itemName) {
    throw new Error("请输入适用物品");
  }
  const steps = normalizeLifeGuideSteps(event.steps);
  if (!steps.length) {
    throw new Error("请至少添加一步图文教程");
  }

  await ensureCollections();

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const now = new Date().toISOString();
  const res = await db.collection(COLLECTION_NAMES.lifeGuides).add({
    data: {
      elderId,
      title: String(event.title).trim(),
      itemName: String(event.itemName).trim(),
      steps,
      videoFileID: event.videoFileID ? String(event.videoFileID).trim() : "",
      createdAt: now,
      updatedAt: now,
      createdBy: user._id
    }
  });

  return { id: res._id, success: true };
}

async function updateLifeGuide(event = {}) {
  if (!event.guideId) {
    throw new Error("缺少教程ID");
  }

  await ensureCollections();

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const res = await db.collection(COLLECTION_NAMES.lifeGuides).doc(event.guideId).get();
  const guide = res.data;

  if (!guide || guide.elderId !== elderId) {
    throw new Error("教程不存在或无权修改");
  }

  const updateData = {
    updatedAt: new Date().toISOString()
  };

  const nextSteps = event.steps !== undefined
    ? normalizeLifeGuideSteps(event.steps)
    : normalizeLifeGuideSteps(guide.steps, guide);

  if (event.title !== undefined) updateData.title = String(event.title || "").trim();
  if (event.itemName !== undefined) updateData.itemName = String(event.itemName || "").trim();
  if (event.steps !== undefined) updateData.steps = nextSteps;
  if (event.videoFileID !== undefined) updateData.videoFileID = String(event.videoFileID || "").trim();

  const finalTitle = updateData.title !== undefined ? updateData.title : (guide.title || "");
  const finalItemName = updateData.itemName !== undefined ? updateData.itemName : (guide.itemName || "");
  const finalSteps = updateData.steps !== undefined ? updateData.steps : nextSteps;

  if (!finalTitle) {
    throw new Error("教程标题不能为空");
  }
  if (!finalItemName) {
    throw new Error("请输入适用物品");
  }
  if (!finalSteps.length) {
    throw new Error("请至少保留一步图文教程");
  }

  await db.collection(COLLECTION_NAMES.lifeGuides).doc(event.guideId).update({
    data: updateData
  });

  return { success: true };
}

async function deleteLifeGuide(event = {}) {
  if (!event.guideId) {
    throw new Error("缺少教程ID");
  }

  await ensureCollections();

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const res = await db.collection(COLLECTION_NAMES.lifeGuides).doc(event.guideId).get();
  const guide = res.data;

  if (!guide || guide.elderId !== elderId) {
    throw new Error("教程不存在或无权删除");
  }

  await db.collection(COLLECTION_NAMES.lifeGuides).doc(event.guideId).remove();
  return { success: true };
}

async function importDemoData(event = {}) {
  await ensureCollections();

  if (event.confirm !== "IMPORT_DEMO_DATA") {
    throw new Error("请传入 confirm=IMPORT_DEMO_DATA 后再执行导入");
  }

  const collectionMap = {
    users: COLLECTION_NAMES.users,
    persons: COLLECTION_NAMES.persons,
    memories: COLLECTION_NAMES.memories,
    healthRecords: COLLECTION_NAMES.healthRecords,
    voiceMessages: COLLECTION_NAMES.voiceMessages,
    lifeGuides: COLLECTION_NAMES.lifeGuides,
    memoryPairs: COLLECTION_NAMES.memoryPairs
  };

  const summary = {};
  const order = [
    "users",
    "persons",
    "memories",
    "healthRecords",
    "voiceMessages",
    "lifeGuides",
    "memoryPairs"
  ];

  for (const key of order) {
    const collectionName = collectionMap[key];
    const docs = Array.isArray(demoData[key]) ? demoData[key] : [];
    summary[key] = 0;

    for (const doc of docs) {
      if (!doc || !doc._id) {
        continue;
      }

      const { _id, ...payload } = doc;
      await db.collection(collectionName).doc(_id).set({
        data: payload
      });
      summary[key] += 1;
    }
  }

  return {
    success: true,
    message: "演示数据导入完成",
    summary
  };
}

async function bindCurrentUserToDemoElder(event = {}) {
  await ensureCollections();

  const user = event.userId ? await getUserById(event.userId) : await getCurrentUser();
  if (!user) {
    throw new Error("未找到指定的用户，请检查 userId");
  }
  const demoElder = await getUserById(DEMO_ELDER_ID);

  if (!demoElder || !isElderUser(demoElder)) {
    throw new Error("演示老人数据不存在，请先执行 importDemoData");
  }

  await db.collection(COLLECTION_NAMES.users).doc(user._id).update({
    data: {
      userType: "family",
      relation: user.relation || "家属",
      boundElderId: DEMO_ELDER_ID,
      boundAt: new Date().toISOString()
    }
  });

  return {
    success: true,
    message: "当前账号已绑定到演示老人",
    elderId: DEMO_ELDER_ID,
    elderName: demoElder.name || "演示老人",
    userId: user._id
  };
}

async function addVoiceMessage(event = {}) {
  await ensureCollections();

  const fileID = typeof event.fileID === "string" ? event.fileID.trim() : "";
  if (!fileID && !(typeof event.note === "string" && event.note.trim())) {
    throw new Error("缺少语音文件");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const senderName = (user.name || "").trim() || "家人";
  const senderRelation = (user.relation || "").trim() || "家人";
  const duration = Number(event.duration || 0);
  const note = typeof event.note === "string" ? event.note.trim().slice(0, 200) : "";

  const res = await db.collection(COLLECTION_NAMES.voiceMessages).add({
    data: {
      elderId,
      fileID,
      duration: fileID && Number.isFinite(duration) ? duration : 0,
      senderName,
      senderRelation,
      senderRole: normalizeUserType(user),
      note,
      isReadByElder: false,
      createdAt: new Date().toISOString()
    }
  });

  return { id: res._id, success: true };
}

async function getVoiceMessages(event = {}) {
  await ensureCollections();

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const res = await db
    .collection(COLLECTION_NAMES.voiceMessages)
    .where({ elderId })
    .orderBy("createdAt", "desc")
    .get();

  const list = res.data || [];
  const unreadCount = list.filter((item) => !item.isReadByElder).length;

  return {
    unreadCount,
    list: list.map((item) => ({
      id: item._id,
      fileID: item.fileID || "",
      duration: item.duration || 0,
      senderName: item.senderName || "家人",
      senderRelation: item.senderRelation || "家人",
      senderRole: item.senderRole || "family",
      note: item.note || "",
      hasAudio: !!item.fileID,
      isReadByElder: !!item.isReadByElder,
      createdAt: item.createdAt || "",
      readAt: item.readAt || ""
    }))
  };
}

async function markVoiceMessagesRead(event = {}) {
  await ensureCollections();

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const readAt = new Date().toISOString();

  await db
    .collection(COLLECTION_NAMES.voiceMessages)
    .where({ elderId, isReadByElder: false })
    .update({
      data: {
        isReadByElder: true,
        readAt
      }
    });

  return { success: true, readAt };
}

async function createMemoryPair(event = {}) {
  await ensureCollections();
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  if (!event.leftImgFileID || !event.rightImgFileID) {
    throw new Error("缺少配对图片");
  }
  const doc = {
    elderId,
    leftImg: event.leftImgFileID,
    rightImg: event.rightImgFileID,
    leftLabel: event.leftLabel || "",
    rightLabel: event.rightLabel || "",
    notes: event.notes || "",
    createdAt: new Date().toISOString()
  };
  const res = await db.collection(COLLECTION_NAMES.memoryPairs).add({ data: doc });
  return { id: res._id, success: true };
}

async function getMemoryPairs(event = {}) {
  await ensureCollections();
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const res = await db
    .collection(COLLECTION_NAMES.memoryPairs)
    .where({ elderId })
    .orderBy("createdAt", "desc")
    .get();
  return res.data.map(it => ({
    id: it._id,
    leftImg: it.leftImg,
    rightImg: it.rightImg,
    leftLabel: it.leftLabel || "",
    rightLabel: it.rightLabel || "",
    notes: it.notes || "",
    createdAt: it.createdAt
  }));
}

// ==================== 数据修复：重算 eventMonthDay ====================
async function recalcEventMonthDay(event = {}) {
  await ensureCollections();
  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  async function fixForCollection(collectionName) {
    let fixed = 0;
    let offset = 0;
    const pageSize = 100;
    while (true) {
      const res = await db
        .collection(collectionName)
        .where({ elderId })
        .skip(offset)
        .limit(pageSize)
        .get();
      if (!res.data || res.data.length === 0) break;
      for (const doc of res.data) {
        const correct = formatMonthDay(doc.eventDate || "");
        if (correct && doc.eventMonthDay !== correct) {
          await db.collection(collectionName).doc(doc._id).update({
            data: { eventMonthDay: correct }
          });
          fixed += 1;
        }
      }
      offset += res.data.length;
      if (res.data.length < pageSize) break;
    }
    return fixed;
  }

  const fixedElderUploads = await fixForCollection(COLLECTION_NAMES.elderUploads);
  const fixedMemories = await fixForCollection(COLLECTION_NAMES.memories);
  return { success: true, fixedElderUploads, fixedMemories, fixed: fixedElderUploads + fixedMemories };
}

async function recognizeFace(event = {}) {
  if (!event.photoFileID) {
    throw new Error("缺少待识别照片");
  }

  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);
  const result = await db.collection(COLLECTION_NAMES.persons).where({ elderId }).get();
  const persons = result.data || [];

  if (!persons.length) {
    return {
      success: true,
      match: null,
      message: "暂无家庭成员资料，请先添加家人信息"
    };
  }

  const recognizablePersons = persons.filter((person) => person.facePhoto || person.avatar);
  if (!recognizablePersons.length) {
    return {
      success: true,
      match: null,
      message: "请先为家庭成员上传清晰照片"
    };
  }

  const client = createIaiClient();
  const config = assertFaceRecognitionConfigured();
  const groupId = await ensureIaiGroup(client, elderId);
  const imageBase64 = await downloadCloudFileAsBase64(event.photoFileID);

  const searchRes = await client.SearchPersons({
    GroupIds: [groupId],
    Image: imageBase64,
    MaxFaceNum: 1,
    MaxPersonNum: 1,
    NeedRotateDetection: 1,
    FaceModelVersion: FACE_MODEL_VERSION
  });

  const firstResult = searchRes.Results && searchRes.Results[0];
  const firstCandidate = firstResult && firstResult.Candidates && firstResult.Candidates[0];
  const matchedPersonId = firstCandidate && firstCandidate.PersonId;
  const matchedScore = firstCandidate && typeof firstCandidate.Score === "number"
    ? firstCandidate.Score
    : 0;

  if (!matchedPersonId || matchedScore < config.scoreThreshold) {
    return {
      success: true,
      match: null,
      score: matchedScore,
      message: "未识别到家庭成员"
    };
  }

  const matchedPerson = persons.find((person) => getIaiPersonId(person._id) === matchedPersonId);
  if (!matchedPerson) {
    return {
      success: true,
      match: null,
      score: matchedScore,
      message: "识别结果未匹配到本地成员资料"
    };
  }

  return {
    success: true,
    match: {
      id: matchedPerson._id,
      name: matchedPerson.name,
      relation: matchedPerson.relation,
      avatar: matchedPerson.avatar || "",
      facePhoto: matchedPerson.facePhoto || matchedPerson.avatar || "",
      description: matchedPerson.description || "",
      age: matchedPerson.age || null,
      gender: matchedPerson.gender || ""
    },
    score: matchedScore,
    message: "识别成功"
  };
}

async function getBindingQRCodeSafe(event = {}) {
  const user = await getCurrentUser();
  if (!isElderUser(user)) {
    throw new Error("只有老人账号可以生成绑定二维码");
  }

  if (user.bindQrCodeFileID && !event.forceRefresh) {
    return {
      success: true,
      fileID: user.bindQrCodeFileID,
      elderId: user._id
    };
  }

  let qrRes = null;

  try {
    qrRes = await cloud.openapi.wxacode.getUnlimited({
      scene: `inviteElderId=${user._id}`,
      page: "pages/login/login",
      checkPath: false
    });
  } catch (primaryError) {
    try {
      qrRes = await cloud.openapi.wxacode.get({
        path: `pages/login/login?inviteElderId=${user._id}`
      });
    } catch (fallbackError) {
      const detail =
        (fallbackError && (fallbackError.errMsg || fallbackError.message)) ||
        (primaryError && (primaryError.errMsg || primaryError.message)) ||
        "";
      throw new Error(`生成绑定二维码失败，请确认云函数已重新部署并已开启 OpenAPI 权限。${detail}`);
    }
  }

  const fileContent = qrRes && (qrRes.buffer || qrRes.resultBuffer || qrRes.result || qrRes.fileContent);
  if (!fileContent) {
    throw new Error("生成绑定二维码失败，未拿到二维码内容");
  }

  const uploadRes = await cloud.uploadFile({
    cloudPath: `binding-qrcodes/${user._id}.png`,
    fileContent: Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent)
  });

  await db.collection(COLLECTION_NAMES.users).doc(user._id).update({
    data: {
      bindQrCodeFileID: uploadRes.fileID,
      bindQrCodeUpdatedAt: new Date().toISOString()
    }
  });

  return {
    success: true,
    fileID: uploadRes.fileID,
    elderId: user._id
  };
}

async function registerAccount(event = {}) {
  await ensureCollections();

  const wxContext = cloud.getWXContext();
  const userCollection = db.collection(COLLECTION_NAMES.users);
  const role = event.role;

  if (role !== "elder" && role !== "family") {
    throw new Error("注册时请选择身份");
  }

  const existingUser = await userCollection.where({ openId: wxContext.OPENID }).get();
  if (existingUser.data.length) {
    const user = existingUser.data[0];
    if (user.userType && user.userType !== role) {
      throw new Error(`当前微信号已注册为${user.userType === "elder" ? "老人" : "家属"}`);
    }
    return {
      success: true,
      alreadyRegistered: true,
      token: `cloud-${wxContext.OPENID}`,
      userType: user.userType || role,
      userId: user._id,
      boundElderId: user.boundElderId || ""
    };
  }

  const addResult = await userCollection.add({
    data: {
      openId: wxContext.OPENID,
      name: "",
      avatar: "",
      age: null,
      phone: "",
      gender: "",
      userType: role,
      relation: role === "family" ? "家属" : "本人",
      healthStatus: {
        bloodPressure: "",
        heartRate: null,
        bloodSugar: ""
      },
      createdAt: new Date().toISOString()
    }
  });

  return {
    success: true,
    alreadyRegistered: false,
    token: `cloud-${wxContext.OPENID}`,
    userType: role,
    userId: addResult._id,
    boundElderId: ""
  };
}

async function loginAccount() {
  await ensureCollections();

  const wxContext = cloud.getWXContext();
  const userCollection = db.collection(COLLECTION_NAMES.users);
  const existingUser = await userCollection.where({ openId: wxContext.OPENID }).get();

  if (!existingUser.data.length) {
    throw new Error("当前微信号未注册，请先注册");
  }

  const user = existingUser.data[0];
  return {
    token: `cloud-${wxContext.OPENID}`,
    userType: user.userType || "elder",
    userId: user._id,
    boundElderId: user.boundElderId || ""
  };
}

async function registerAccountV2(event = {}) {
  await ensureCollections();

  const wxContext = cloud.getWXContext();
  const userCollection = db.collection(COLLECTION_NAMES.users);
  const role = event.role;

  if (role !== "elder" && role !== "family") {
    throw new Error("注册时请选择身份");
  }

  const existingUser = await userCollection.where({ openId: wxContext.OPENID }).get();
  if (existingUser.data.length) {
    const user = existingUser.data[0];
    if (user.userType && user.userType !== role) {
      throw new Error(`当前微信号已注册为${user.userType === "elder" ? "老人" : "家属"}`);
    }

    return {
      success: true,
      alreadyRegistered: true,
      token: `cloud-${wxContext.OPENID}`,
      userType: user.userType || role,
      userId: user._id,
      boundElderId: user.boundElderId || ""
    };
  }

  const addResult = await userCollection.add({
    data: {
      openId: wxContext.OPENID,
      name: "",
      avatar: "",
      age: null,
      phone: "",
      gender: "",
      userType: role,
      relation: role === "family" ? "家属" : "本人",
      healthStatus: {
        bloodPressure: "",
        heartRate: null,
        bloodSugar: ""
      },
      createdAt: new Date().toISOString()
    }
  });

  return {
    success: true,
    alreadyRegistered: false,
    token: `cloud-${wxContext.OPENID}`,
    userType: role,
    userId: addResult._id,
    boundElderId: ""
  };
}

async function loginAccountV2() {
  await ensureCollections();

  const wxContext = cloud.getWXContext();
  const userCollection = db.collection(COLLECTION_NAMES.users);
  const existingUser = await userCollection.where({ openId: wxContext.OPENID }).get();

  if (!existingUser.data.length) {
    throw new Error("当前微信号未注册，请先注册");
  }

  const user = existingUser.data[0];
  return {
    success: true,
    token: `cloud-${wxContext.OPENID}`,
    userType: user.userType || "elder",
    userId: user._id,
    boundElderId: user.boundElderId || ""
  };
}

function buildAuthResult(user, wxContext, fallbackRole = "elder") {
  return {
    success: true,
    token: `cloud-${wxContext.OPENID}`,
    userType: user.userType || fallbackRole || "elder",
    userId: user._id,
    boundElderId: user.boundElderId || "",
    phone: user.phone || ""
  };
}

function normalizePhoneInfo(raw = {}) {
  const phoneNumber = raw.phoneNumber || raw.phone_number || "";
  const purePhoneNumber = raw.purePhoneNumber || raw.pure_phone_number || "";
  const countryCode = String(raw.countryCode || raw.country_code || "").trim();
  const normalizedPhone = normalizePhone(purePhoneNumber || phoneNumber);

  if (!normalizedPhone) {
    return null;
  }

  return {
    phoneNumber: phoneNumber || normalizedPhone,
    purePhoneNumber: normalizedPhone,
    countryCode
  };
}

function extractPhoneInfo(payload) {
  const candidates = [
    payload,
    payload && payload.phoneInfo,
    payload && payload.phone_info,
    payload && payload.phoneInfo && payload.phoneInfo.phoneInfo,
    payload && payload.phone_info && payload.phone_info.phone_info,
    payload && payload.result,
    payload && payload.result && payload.result.phoneInfo,
    payload && payload.result && payload.result.phone_info,
    payload && payload.result && payload.result.phoneInfo && payload.result.phoneInfo.phoneInfo,
    payload && payload.result && payload.result.phone_info && payload.result.phone_info.phone_info,
    payload && payload.list && payload.list[0],
    payload && payload.list && payload.list[0] && payload.list[0].phoneInfo,
    payload && payload.list && payload.list[0] && payload.list[0].phone_info,
    payload && payload.list && payload.list[0] && payload.list[0].data,
    payload && payload.list && payload.list[0] && payload.list[0].data && payload.list[0].data.phoneInfo,
    payload && payload.list && payload.list[0] && payload.list[0].data && payload.list[0].data.phone_info
  ];

  for (const item of candidates) {
    const normalized = normalizePhoneInfo(item || {});
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

async function getPhoneInfoFromPhoneCredential(event = {}) {
  if (event.phoneCode) {
    let primaryError = null;

    try {
      const result = await cloud.openapi.phonenumber.getPhoneNumber({
        code: event.phoneCode
      });
      const phoneInfo = extractPhoneInfo(result);
      if (phoneInfo) {
        return phoneInfo;
      }
      primaryError = new Error("openapi response does not contain phone info");
    } catch (error) {
      primaryError = error;
    }

    try {
      const fallbackResult = await cloud.callOpenAPI({
        api: "wxa/business/getuserphonenumber",
        data: {
          code: event.phoneCode
        }
      });
      const phoneInfo = extractPhoneInfo(fallbackResult);
      if (phoneInfo) {
        return phoneInfo;
      }
    } catch (_) {
      const detail =
        (primaryError && (primaryError.errMsg || primaryError.message)) ||
        "getPhoneNumber failed";
      throw new Error(`鑾峰彇寰俊鎵嬫満鍙峰け璐ワ細${detail}`);
    }
  }

  if (event.cloudID) {
    const openData = await cloud.getOpenData({
      list: [event.cloudID]
    });
    const phoneInfo = extractPhoneInfo(openData);
    if (phoneInfo) {
      return phoneInfo;
    }
  }

  throw new Error("缂哄皯鍙敤鐨勬墜鏈哄彿鎺堟潈鍑瘉");
}

async function quickLoginWithPhoneV2(event = {}) {
  await ensureCollections();

  const wxContext = cloud.getWXContext();
  const userCollection = db.collection(COLLECTION_NAMES.users);
  const role = event.role;

  if (role !== "elder" && role !== "family") {
    throw new Error("娉ㄥ唽鏃惰閫夋嫨韬唤");
  }

  const phoneInfo = await getPhoneInfoFromPhoneCredential(event);
  const phone = normalizePhone((phoneInfo && phoneInfo.purePhoneNumber) || "");
  if (!phone || phone.length !== 11) {
    throw new Error("鏈幏鍙栧埌鏈夋晥鐨勬墜鏈哄彿");
  }

  const existingUser = await userCollection.where({ openId: wxContext.OPENID }).get();
  const now = new Date().toISOString();

  if (existingUser.data.length) {
    const user = existingUser.data[0];
    if (user.userType && user.userType !== role) {
      throw new Error(`褰撳墠寰俊鍙峰凡娉ㄥ唽涓?{user.userType === "elder" ? "鑰佷汉" : "瀹跺睘"}`);
    }

    await userCollection.doc(user._id).update({
      data: {
        phone,
        updatedAt: now
      }
    });

    return buildAuthResult(
      {
        ...user,
        phone
      },
      wxContext,
      role
    );
  }

  const addResult = await userCollection.add({
    data: {
      openId: wxContext.OPENID,
      name: "",
      avatar: "",
      age: null,
      phone,
      gender: "",
      userType: role,
      relation: role === "family" ? "瀹跺睘" : "鏈汉",
      healthStatus: {
        bloodPressure: "",
        heartRate: null,
        bloodSugar: ""
      },
      createdAt: now,
      updatedAt: now
    }
  });

  return buildAuthResult(
    {
      _id: addResult._id,
      userType: role,
      boundElderId: "",
      phone
    },
    wxContext,
    role
  );
}

async function addMedication(event = {}) {
  if (!event.name) {
    throw new Error("药物名称不能为空");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const reminderRule = normalizeReminderRule(event);

  const result = await db.collection(COLLECTION_NAMES.healthRecords).add({
    data: {
      elderId,
      type: "medication",
      name: String(event.name || "").trim(),
      frequency: String(event.frequency || "").trim(),
      dosage: String(event.dosage || "").trim(),
      time: String(event.time || "").trim(),
      notes: String(event.notes || "").trim(),
      ...reminderRule,
      createdAt: new Date().toISOString()
    }
  });

  return { id: result._id, success: true };
}

async function updateMedication(event = {}) {
  if (!event.recordId) {
    throw new Error("缺少用药记录ID");
  }

  if (!event.name) {
    throw new Error("药物名称不能为空");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const recordRes = await db.collection(COLLECTION_NAMES.healthRecords).doc(event.recordId).get();
  const record = recordRes.data;

  if (!record || record.elderId !== elderId || record.type !== "medication") {
    throw new Error("用药记录不存在");
  }

  const reminderRule = normalizeReminderRule(event, record);

  await db.collection(COLLECTION_NAMES.healthRecords).doc(event.recordId).update({
    data: {
      name: String(event.name || "").trim(),
      frequency: String(event.frequency || "").trim(),
      dosage: String(event.dosage || "").trim(),
      time: String(event.time || "").trim(),
      notes: String(event.notes || "").trim(),
      ...reminderRule,
      updatedAt: new Date().toISOString()
    }
  });

  return { success: true };
}

async function addVoiceMessage(event = {}) {
  await ensureCollections();

  const fileID = typeof event.fileID === "string" ? event.fileID.trim() : "";
  const note = typeof event.note === "string" ? event.note.trim().slice(0, 200) : "";
  const messageType = event.messageType === "reminder" ? "reminder" : "message";

  if (!fileID && !note) {
    throw new Error("缺少留言内容");
  }

  if (messageType === "reminder" && !note) {
    throw new Error("提醒内容不能为空");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const senderName = (user.name || "").trim() || "家人";
  const senderRelation = (user.relation || "").trim() || "家人";
  const duration = Number(event.duration || 0);
  const reminderRule =
    messageType === "reminder"
      ? normalizeReminderRule(
          {
            reminderEnabled: true,
            reminderTime: event.reminderTime,
            reminderScheduleType: event.reminderScheduleType,
            reminderDate: event.reminderDate,
            reminderWeekdays: event.reminderWeekdays
          },
          { reminderEnabled: true, reminderTime: "09:00", reminderScheduleType: "daily" }
        )
      : normalizeReminderRule({ reminderEnabled: false });

  const res = await db.collection(COLLECTION_NAMES.voiceMessages).add({
    data: {
      elderId,
      fileID,
      duration: fileID && Number.isFinite(duration) ? duration : 0,
      senderName,
      senderRelation,
      senderRole: normalizeUserType(user),
      note,
      messageType,
      ...reminderRule,
      isReadByElder: messageType === "reminder",
      createdAt: new Date().toISOString()
    }
  });

  return { id: res._id, success: true };
}

async function getVoiceMessages(event = {}) {
  await ensureCollections();

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);
  const res = await db
    .collection(COLLECTION_NAMES.voiceMessages)
    .where({ elderId })
    .orderBy("createdAt", "desc")
    .get();

  const list = res.data || [];
  const unreadCount = list.filter((item) => item.messageType !== "reminder" && !item.isReadByElder).length;

  return {
    unreadCount,
    list: list.map((item) => ({
      id: item._id,
      fileID: item.fileID || "",
      duration: item.duration || 0,
      senderName: item.senderName || "家人",
      senderRelation: item.senderRelation || "家人",
      senderRole: item.senderRole || "family",
      note: item.note || "",
      hasAudio: !!item.fileID,
      isReadByElder: !!item.isReadByElder,
      messageType: item.messageType || "message",
      reminderEnabled: !!item.reminderEnabled,
      reminderTime: item.reminderTime || "",
      reminderScheduleType: item.reminderScheduleType || "daily",
      reminderDate: item.reminderDate || "",
      reminderWeekdays: normalizeReminderWeekdays(item.reminderWeekdays),
      activeToday: isReminderActiveOnDate(item),
      createdAt: item.createdAt || "",
      readAt: item.readAt || ""
    }))
  };
}

async function completeTodayTask(event = {}) {
  await ensureCollections();

  const user = await getCurrentUser();
  if (normalizeUserType(user) !== "elder") {
    throw new Error("只有老人本人可以标记完成");
  }

  const elderId = await resolveElderIdForEvent(user, event);
  const taskType = String(event.taskType || "medication").trim();
  const taskId = String(event.taskId || "").trim();
  const dateKey = getDateKey(event.dateKey || new Date());

  if (!taskId) {
    throw new Error("缺少提醒ID");
  }

  let task = null;
  let title = "";
  let subtitle = "";

  if (taskType === "medication") {
    const taskRes = await db.collection(COLLECTION_NAMES.healthRecords).doc(taskId).get();
    task = taskRes.data;

    if (!task || task.elderId !== elderId || task.type !== "medication") {
      throw new Error("提醒不存在");
    }

    title = task.name || "今日提醒";
    subtitle = buildTaskSubtitle(task);
  } else if (taskType === "messageReminder") {
    const taskRes = await db.collection(COLLECTION_NAMES.voiceMessages).doc(taskId).get();
    task = taskRes.data;

    if (!task || task.elderId !== elderId || task.messageType !== "reminder") {
      throw new Error("提醒不存在");
    }

    title = task.note || "待办提醒";
    subtitle = [task.reminderTime || "", task.senderName || ""].filter(Boolean).join(" 路 ");
  } else {
    throw new Error("暂不支持该提醒类型");
  }

  const existing = await db
    .collection(COLLECTION_NAMES.dailyTaskLogs)
    .where({ elderId, dateKey, taskType, taskId })
    .get();

  if (existing.data && existing.data.length) {
    return {
      success: true,
      id: existing.data[0]._id,
      duplicated: true
    };
  }

  const completedAt = new Date().toISOString();
  const res = await db.collection(COLLECTION_NAMES.dailyTaskLogs).add({
    data: {
      elderId,
      dateKey,
      taskType,
      taskId,
      title,
      subtitle,
      time: task.reminderTime || task.time || "",
      frequency: task.frequency || "",
      dosage: task.dosage || "",
      notes: task.notes || task.note || "",
      completedAt,
      completedBy: user._id,
      completedByRole: normalizeUserType(user)
    }
  });

  return {
    success: true,
    id: res._id,
    item: {
      id: res._id,
      taskType,
      taskId,
      title,
      subtitle,
      time: task.reminderTime || task.time || "",
      frequency: task.frequency || "",
      dosage: task.dosage || "",
      notes: task.notes || task.note || "",
      completedAt
    }
  };
}

exports.main = async (event) => {
  try {
    switch (event.action) {
      case "register":
        return await registerAccountV2(event);
      case "login":
        return await loginAccountV2();
      case "quickLoginWithPhone":
        return await quickLoginWithPhoneV2(event);
      case "getElderList":
        return await getElderList();
      case "getElderBindInfo":
        return await getElderBindInfo(event);
      case "getBindingQRCode":
        return await getBindingQRCodeSafe(event);
      case "getMemoryPlaybackConfig":
        return getMemoryPlaybackConfig();
      case "findElderByPhone":
        return await findElderByPhone(event);
      case "bindElder":
        return await bindElder(event);
      case "createBindingRequest":
        return await createBindingRequest(event);
      case "getMyBindingRequests":
        return await getMyBindingRequests();
      case "getBindingRequests":
        return await getBindingRequests();
      case "approveBindingRequest":
        return await approveBindingRequest(event);
      case "rejectBindingRequest":
        return await rejectBindingRequest(event);
      case "getPersonList":
        return await getPersonList();
      case "getFamilyTree":
        return await getFamilyTree();
      case "getPersonDetail":
        return await getPersonDetail(event);
      case "getElderInfo":
        return await getElderInfo(event);
      case "updateElderInfo":
        return await updateElderInfo(event);
      case "addPerson":
        return await addPerson(event);
      case "updatePerson":
        return await updatePerson(event);
      case "deletePerson":
        return await deletePerson(event);
      case "getMemories":
        return await getMemories(event);
      case "addMemory":
        return await addMemory(event);
      case "updateMemory":
        return await updateMemory(event);
      case "deleteMemory":
        return await deleteMemory(event);
      case "getHealthInfo":
        return await getHealthInfo(event);
      case "getTodayCompletedTasks":
        return await getTodayCompletedTasks(event);
      case "completeTodayTask":
        return await completeTodayTask(event);
      case "addMedicalHistory":
        return await addMedicalHistory(event);
      case "addMedication":
        return await addMedication(event);
      case "updateMedication":
        return await updateMedication(event);
      case "addHealthMeasurement":
        return await addHealthMeasurement(event);
      case "updateTodayHealth":
        return await updateTodayHealth(event);
      case "deleteHealthRecord":
        return await deleteHealthRecord(event);
      case "addElderUpload":
        return await addElderUpload(event);
      case "getElderUploads":
        return await getElderUploads(event);
      case "getOnThisDayMemory":
        return await getOnThisDayMemory(event);
      case "addVoiceMessage":
        return await addVoiceMessage(event);
      case "getVoiceMessages":
        return await getVoiceMessages(event);
      case "markVoiceMessagesRead":
        return await markVoiceMessagesRead(event);
      case "getLifeGuides":
        return await getLifeGuides(event);
      case "getLifeGuideDetail":
        return await getLifeGuideDetail(event);
      case "addLifeGuide":
        return await addLifeGuide(event);
      case "updateLifeGuide":
        return await updateLifeGuide(event);
      case "deleteLifeGuide":
        return await deleteLifeGuide(event);
      case "importDemoData":
        return await importDemoData(event);
      case "bindCurrentUserToDemoElder":
        return await bindCurrentUserToDemoElder(event);
      case "createMemoryPair":
        return await createMemoryPair(event);
      case "getMemoryPairs":
        return await getMemoryPairs(event);
      case "recalcEventMonthDay":
        return await recalcEventMonthDay(event);
      case "recognizeFace":
        return await recognizeFace(event);
      default:
        throw new Error("未知操作");
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || "云函数执行失败"
    };
  }
};





