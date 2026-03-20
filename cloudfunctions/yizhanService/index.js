const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 鏁版嵁搴撻泦鍚堝悕绉伴厤缃?
const COLLECTION_NAMES = {
  users: "users",
  persons: "persons",
  memories: "memories",
  healthRecords: "healthRecords"
};

/**
 * 纭繚闆嗗悎瀛樺湪
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

/**
 * 鑾峰彇褰撳墠鐢ㄦ埛
 */
async function getCurrentUser() {
  const wxContext = cloud.getWXContext();
  const result = await db.collection(COLLECTION_NAMES.users).where({ openId: wxContext.OPENID }).get();

  if (!result.data.length) {
    throw new Error("鐢ㄦ埛涓嶅瓨鍦紝璇峰厛鐧诲綍");
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
  if (!requestedElderId) {
    return getEffectiveElderId(user);
  }

  if (requestedElderId === user._id) {
    return user._id;
  }

  if (user.boundElderId && user.boundElderId !== requestedElderId) {
    throw new Error("当前绑定的老人不匹配，请重新绑定后再试");
  }

  const elder = await getUserById(requestedElderId);
  if (!elder || !isElderUser(elder)) {
    throw new Error("老人不存在");
  }

  return requestedElderId;
}

async function getUserById(userId) {
  const result = await db.collection(COLLECTION_NAMES.users).doc(userId).get();
  return result.data;
}

/**
 * 鐧诲綍 - 鍒涘缓鎴栬幏鍙栫敤鎴?
 */
async function login(event = {}) {
  await ensureCollections();

  const wxContext = cloud.getWXContext();
  const userCollection = db.collection(COLLECTION_NAMES.users);
  const role = event.role || "elder";

  // 鏌ユ壘宸插瓨鍦ㄧ殑鐢ㄦ埛
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
      userId: user._id
    };
  }

  // 鍒涘缓鏂扮敤鎴?- 鍩虹淇℃伅锛屾棤婕旂ず鏁版嵁
  const addResult = await userCollection.add({
    data: {
      openId: wxContext.OPENID,
      name: "",
      avatar: "",
      age: null,
      gender: "",
      userType: role || "elder",
      relation: "鏈汉",
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
    userId: addResult._id
  };
}
// ==================== 浜虹墿鐩稿叧 ====================
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
  const elder = await getUserById(event.elderId);

  if (!elder || !isElderUser(elder)) {
    throw new Error("老人不存在");
  }

  await db.collection(COLLECTION_NAMES.users).doc(user._id).update({
    data: {
      boundElderId: event.elderId,
      boundAt: new Date().toISOString()
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
    relation: person.relation,
    age: person.age,
    description: person.description
  }));
}

function buildTree(persons) {
  const nodeMap = new Map();
  const roots = [];

  // 鍏崇郴鏄犲皠锛氱‘瀹氱埗瀛愬叧绯?
  const relationParentMap = {
    "绁栫埗": null,      // 绁栫埗鏄牴鑺傜偣
    "绁栨瘝": null,      // 绁栨瘝鏄牴鑺傜偣
    "鐖朵翰": ["绁栫埗", "绁栨瘝"],  // 鐖朵翰鐨勭埗姣嶆槸绁栫埗/绁栨瘝
    "姣嶄翰": null,
    "鍙斿彅": ["绁栫埗", "绁栨瘝"],  // 鍙斿彅鐨勭埗姣嶆槸绁栫埗/绁栨瘝
    "濮戝": ["绁栫埗", "绁栨瘝"],
    "鏈汉": ["鐖朵翰", "姣嶄翰"],  // 鏈汉鐨勭埗姣?
    "鍎垮瓙": ["鏈汉"],
    "濂冲効": ["鏈汉"],
    "瀛欏瓙": ["鏈汉", "鍎垮瓙"],
    "瀛欏コ": ["鏈汉", "鍎垮瓙"]
  };

  persons.forEach((person) => {
    nodeMap.set(person._id, {
      id: person._id,
      name: person.name,
      avatar: person.avatar,
      relation: person.relation,
      age: person.age,
      health: person.health || "鏈煡",
      description: person.description,
      children: []
    });
  });

  // 寤虹珛鐖跺瓙鍏崇郴
  persons.forEach((person) => {
    const node = nodeMap.get(person._id);

    // 浼樺厛浣跨敤鏁版嵁搴撲腑鐨?parentPersonId
    if (person.parentPersonId && nodeMap.has(person.parentPersonId)) {
      nodeMap.get(person.parentPersonId).children.push(node);
      return;
    }

    // 濡傛灉娌℃湁 parentPersonId锛屽皾璇曟牴鎹叧绯绘帹鏂?
    const parentRelations = relationParentMap[person.relation];
    if (parentRelations && parentRelations.length > 0) {
      // 鏌ユ壘鍏锋湁鎸囧畾鍏崇郴鐨勬垚鍛?
      for (const parentRelation of parentRelations) {
        const parent = persons.find(p => p.relation === parentRelation);
        if (parent && nodeMap.has(parent._id)) {
          nodeMap.get(parent._id).children.push(node);
          return;
        }
      }
    }

    // 娌℃湁鐖惰妭鐐癸紝浣滀负鏍硅妭鐐?
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
    throw new Error("缂哄皯 personId");
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
    relation: person.relation,
    age: person.age,
    gender: person.gender,
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
 * 娣诲姞瀹跺涵鎴愬憳
 */
async function addPerson(event) {
  if (!event.name) {
    throw new Error("濮撳悕涓嶈兘涓虹┖");
  }

  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);

  const result = await db.collection(COLLECTION_NAMES.persons).add({
    data: {
      elderId: elderId,
      name: event.name,
      avatar: event.avatar || "",
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

  return { id: result._id, success: true };
}

/**
 * 鏇存柊瀹跺涵鎴愬憳淇℃伅
 */
async function updatePerson(event) {
  if (!event.personId) {
    throw new Error("缂哄皯鎴愬憳ID");
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

  return { success: true };
}

/**
 * 鍒犻櫎瀹跺涵鎴愬憳
 */
async function deletePerson(event) {
  if (!event.personId) {
    throw new Error("缂哄皯鎴愬憳ID");
  }

  const user = await getCurrentUser();
  const elderId = await getEffectiveElderId(user);

  const person = await db.collection(COLLECTION_NAMES.persons).doc(event.personId).get();
  if (!person.data || person.data.elderId !== elderId) {
    throw new Error("成员不存在或无权限删除");
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
    createdAt: memory.createdAt
  }));
}

async function addMemory(event = {}) {
  if (!event.title || !event.story) {
    throw new Error("标题和故事内容不能为空");
  }

  const user = await getCurrentUser();
  const elderId = await resolveElderIdForEvent(user, event);

  const year = event.year || new Date().getFullYear();
  const decade = Math.floor(year / 10) % 100 + "0";

  const result = await db.collection(COLLECTION_NAMES.memories).add({
    data: {
      elderId: elderId,
      year: year,
      decade: decade,
      type: event.type || "daily",
      title: event.title,
      img: event.img || "",
      story: event.story,
      person: event.person || "",
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
  if (event.title) updateData.title = event.title;
  if (event.story) updateData.story = event.story;
  if (event.img) updateData.img = event.img;
  if (event.person) updateData.person = event.person;
  if (event.type) updateData.type = event.type;
  if (event.year) {
    updateData.year = event.year;
    updateData.decade = Math.floor(event.year / 10) % 100 + "0";
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

  return {
    todayHealth: (elder && elder.healthStatus) || {
      bloodPressure: "",
      heartRate: null,
      bloodSugar: ""
    },
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
      notes: item.notes
    }))
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
      createdAt: new Date().toISOString()
    }
  });

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

// ==================== ????? ====================

exports.main = async (event) => {
  try {
    switch (event.action) {
      case "login":
        return await login(event);
      case "getElderList":
        return await getElderList();
      case "bindElder":
        return await bindElder(event);
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
      case "addMedicalHistory":
        return await addMedicalHistory(event);
      case "addMedication":
        return await addMedication(event);
      case "updateTodayHealth":
        return await updateTodayHealth(event);
      case "deleteHealthRecord":
        return await deleteHealthRecord(event);
      default:
        throw new Error("鏈煡鎿嶄綔");
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || "云函数执行失败"
    };
  }
};










