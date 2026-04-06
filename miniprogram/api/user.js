const FUNCTION_NAME = "yizhanService";
const FAMILY_ELDER_ACTIONS = new Set([
  "getElderInfo",
  "updateElderInfo",
  "getPersonList",
  "getPersonDetail",
  "addPerson",
  "updatePerson",
  "deletePerson",
  "getMemories",
  "addMemory",
  "updateMemory",
  "deleteMemory",
  "getHealthInfo",
  "getTodayCompletedTasks",
  "addMedicalHistory",
  "addMedication",
  "updateMedication",
  "addHealthMeasurement",
  "updateTodayHealth",
  "deleteHealthRecord",
  "addVoiceMessage",
  "getVoiceMessages",
  "markVoiceMessagesRead",
  "getLifeGuides",
  "getLifeGuideDetail",
  "addLifeGuide",
  "updateLifeGuide",
  "deleteLifeGuide"
]);

function callService(action, data = {}) {
  return new Promise((resolve, reject) => {
    const payload = {
      action,
      ...data
    };

    const role = wx.getStorageSync("role");
    const elderId = wx.getStorageSync("elderId");
    if (role === "family" && elderId && FAMILY_ELDER_ACTIONS.has(action) && !payload.elderId) {
      payload.elderId = elderId;
    }

    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: payload,
      success: (res) => {
        const result = res.result;

        if (result && result.success === false) {
          reject(result);
          return;
        }

        resolve(result);
      },
      fail: reject
    });
  });
}

function registerAPI(role) {
  return callService("register", { role });
}

function loginAPI() {
  return callService("login");
}

function getPersonListAPI() {
  return callService("getPersonList");
}

function getElderListAPI() {
  return callService("getElderList");
}

function getElderBindInfoAPI(elderId) {
  return callService("getElderBindInfo", { elderId });
}

function getBindingQRCodeAPI(forceRefresh = false) {
  return callService("getBindingQRCode", { forceRefresh });
}

function importDemoDataAPI() {
  return callService("importDemoData", { confirm: "IMPORT_DEMO_DATA" });
}

function bindCurrentUserToDemoElderAPI() {
  return callService("bindCurrentUserToDemoElder");
}

function findElderByPhoneAPI(phone) {
  return callService("findElderByPhone", { phone });
}

function bindElderAPI(elderId) {
  return callService("bindElder", { elderId });
}

function createBindingRequestAPI(data) {
  return callService("createBindingRequest", data);
}

function getMyBindingRequestsAPI() {
  return callService("getMyBindingRequests");
}

function getBindingRequestsAPI() {
  return callService("getBindingRequests");
}

function approveBindingRequestAPI(requestId) {
  return callService("approveBindingRequest", { requestId });
}

function rejectBindingRequestAPI(requestId) {
  return callService("rejectBindingRequest", { requestId });
}

function getFamilyTreeAPI() {
  return callService("getFamilyTree");
}

function getPersonDetailAPI(personId) {
  return callService("getPersonDetail", { personId });
}

function getElderInfoAPI() {
  return callService("getElderInfo");
}

function updateElderInfoAPI(data) {
  return callService("updateElderInfo", data);
}

/**
 * 获取记忆列表
 * @param {Object} options - 筛选条件
 * @param {string} options.person - 按人物筛选
 * @param {string} options.decade - 按年代筛选
 * @param {string} options.type - 按类型筛选
 */
function getMemoriesAPI(options = {}) {
  return callService("getMemories", options);
}

/**
 * 添加新记忆
 * @param {Object} memory - 记忆数据
 */
function addMemoryAPI(memory) {
  return callService("addMemory", memory);
}

/**
 * 更新记忆
 * @param {Object} memory - 更新数据
 */
function updateMemoryAPI(memory) {
  return callService("updateMemory", memory);
}

/**
 * 删除记忆
 * @param {string} memoryId - 记忆ID
 */
function deleteMemoryAPI(memoryId) {
  return callService("deleteMemory", { memoryId });
}

/**
 * 获取健康信息
 */
function getHealthInfoAPI() {
  return callService("getHealthInfo");
}

/**
 * 添加病史记录
 * @param {Object} history - 病史数据
 */
function addMedicalHistoryAPI(history) {
  return callService("addMedicalHistory", history);
}

/**
 * 添加用药记录
 * @param {Object} medication - 用药数据
 */
function addMedicationAPI(medication) {
  return callService("addMedication", medication);
}

function updateMedicationAPI(medication) {
  return callService("updateMedication", medication);
}

function addHealthMeasurementAPI(measurement) {
  return callService("addHealthMeasurement", measurement);
}

/**
 * 更新今日健康数据
 * @param {Object} health - 健康数据
 */
function updateTodayHealthAPI(health) {
  return callService("updateTodayHealth", health);
}

/**
 * 删除健康记录
 * @param {string} recordId - 记录ID
 */
function deleteHealthRecordAPI(recordId) {
  return callService("deleteHealthRecord", { recordId });
}

/**
 * 老人端：新增上传（图片或文字）
 * @param {Object} payload
 * @param {"image"|"text"} payload.type
 * @param {string} [payload.fileID] - 图片 fileID（当 type 为 image 时）
 * @param {string} [payload.content] - 文本内容（当 type 为 text 时）
 * @param {string} [payload.eventDate] - 事件日期（ISO 字符串）
 */
function addElderUploadAPI(payload) {
  return callService("addElderUpload", payload || {});
}

/**
 * 老人端：获取上传列表
 * 可用于“我的资料”或历史上传列表
 */
function getElderUploadsAPI() {
  return callService("getElderUploads");
}

/**
 * 首页：历史上的今天
 */
function getOnThisDayMemoryAPI() {
  return callService("getOnThisDayMemory");
}

function addVoiceMessageAPI(payload) {
  return callService("addVoiceMessage", payload || {});
}

function getVoiceMessagesAPI(options = {}) {
  return callService("getVoiceMessages", options);
}

function markVoiceMessagesReadAPI() {
  return callService("markVoiceMessagesRead");
}

function getLifeGuidesAPI(options = {}) {
  return callService("getLifeGuides", options);
}

function getLifeGuideDetailAPI(guideId) {
  return callService("getLifeGuideDetail", { guideId });
}

function addLifeGuideAPI(payload) {
  return callService("addLifeGuide", payload || {});
}

function updateLifeGuideAPI(payload) {
  return callService("updateLifeGuide", payload || {});
}

function deleteLifeGuideAPI(guideId) {
  return callService("deleteLifeGuide", { guideId });
}

/**
 * 创建配对素材
 * @param {Object} payload
 * @param {string} payload.leftImgFileID
 * @param {string} payload.rightImgFileID
 * @param {string} [payload.leftLabel]
 * @param {string} [payload.rightLabel]
 * @param {string} [payload.notes]
 */
function createMemoryPairAPI(payload) {
  return callService("createMemoryPair", payload || {});
}

/**
 * 获取配对素材列表
 */
function getMemoryPairsAPI(options = {}) {
  return callService("getMemoryPairs", options);
}
/**
 * 添加家庭成员
 * @param {Object} person - 成员数据
 */
function addPersonAPI(person) {
  return callService("addPerson", person);
}

/**
 * 更新家庭成员信息
 * @param {Object} person - 更新数据
 */
function updatePersonAPI(person) {
  return callService("updatePerson", person);
}

/**
 * 删除家庭成员
 * @param {string} personId - 成员ID
 */
function deletePersonAPI(personId) {
  return callService("deletePerson", { personId });
}

/**
 * 获取记忆详情
 * @param {string} memoryId - 记忆ID
 */
function getMemoryDetailAPI(memoryId) {
  return callService("getMemoryDetail", { memoryId });
}

// ==================== 人脸识别相关 ====================

/**
 * 上传人脸照片
 * @param {string} tempFilePath - 临时文件路径
 * @param {string} personId - 成员ID（可选）
 */
function uploadFacePhotoAPI(tempFilePath, personId) {
  return callService("uploadFacePhoto", { tempFilePath, personId });
}

/**
 * 人脸识别
 * @param {string} photoFileID - 云存储文件ID
 */
function recognizeFaceAPI(photoFileID) {
  return callService("recognizeFace", { photoFileID });
}

/**
 * 上传并识别人脸
 * @param {string} tempFilePath - 临时文件路径
 */
function uploadAndRecognizeAPI(tempFilePath) {
  return callService("uploadAndRecognize", { tempFilePath });
}

function getTodayCompletedTasksAPI(options = {}) {
  return callService("getTodayCompletedTasks", options);
}

function completeTodayTaskAPI(payload) {
  return callService("completeTodayTask", payload || {});
}

module.exports = {
  registerAPI,
  loginAPI,
  getElderListAPI,
  getElderBindInfoAPI,
  getBindingQRCodeAPI,
  importDemoDataAPI,
  bindCurrentUserToDemoElderAPI,
  findElderByPhoneAPI,
  bindElderAPI,
  createBindingRequestAPI,
  getMyBindingRequestsAPI,
  getBindingRequestsAPI,
  approveBindingRequestAPI,
  rejectBindingRequestAPI,
  getPersonListAPI,
  getFamilyTreeAPI,
  getPersonDetailAPI,
  getElderInfoAPI,
  updateElderInfoAPI,
  getMemoriesAPI,
  addMemoryAPI,
  updateMemoryAPI,
  deleteMemoryAPI,
  getHealthInfoAPI,
  getTodayCompletedTasksAPI,
  completeTodayTaskAPI,
  addMedicalHistoryAPI,
  addMedicationAPI,
  updateMedicationAPI,
  addHealthMeasurementAPI,
  updateTodayHealthAPI,
  deleteHealthRecordAPI,
  addPersonAPI,
  updatePersonAPI,
  deletePersonAPI,
  getMemoryDetailAPI,
  addElderUploadAPI,
  getElderUploadsAPI,
  getOnThisDayMemoryAPI,
  addVoiceMessageAPI,
  getVoiceMessagesAPI,
  markVoiceMessagesReadAPI,
  getLifeGuidesAPI,
  getLifeGuideDetailAPI,
  addLifeGuideAPI,
  updateLifeGuideAPI,
  deleteLifeGuideAPI,
  createMemoryPairAPI,
  getMemoryPairsAPI,
  uploadFacePhotoAPI,
  recognizeFaceAPI,
  uploadAndRecognizeAPI
};
