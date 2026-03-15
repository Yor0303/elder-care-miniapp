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

module.exports = {
  loginAPI,
  getPersonListAPI,
  getFamilyTreeAPI,
  getPersonDetailAPI,
  getElderInfoAPI
};
