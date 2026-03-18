const FUNCTION_NAME = "yizhanService";

function callService(action, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: {
        action,
        ...data
      },
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

function loginAPI() {
  return callService("login");
}

function getPersonListAPI() {
  return callService("getPersonList");
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

module.exports = {
  loginAPI,
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
  addMedicalHistoryAPI,
  addMedicationAPI,
  updateTodayHealthAPI,
  deleteHealthRecordAPI,
  addPersonAPI,
  updatePersonAPI,
  deletePersonAPI,
  getMemoryDetailAPI,
  uploadFacePhotoAPI,
  recognizeFaceAPI,
  uploadAndRecognizeAPI
};
