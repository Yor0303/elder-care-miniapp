// pages/elder/face-recognition.js
const { recognizeFaceAPI } = require("../../api/user");

Page({
  data: {
    cameraAuthorized: false,
    recognizing: false,
    recognizedPerson: null,
    displayAvatar: "",
    noMatch: false,
    errorMessage: ""
  },

  onLoad() {
    this.checkCameraAuth();
  },

  checkCameraAuth() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting["scope.camera"]) {
          this.setData({ cameraAuthorized: true });
        }
      }
    });
  },

  requestCameraAuth() {
    wx.authorize({
      scope: "scope.camera",
      success: () => {
        this.setData({ cameraAuthorized: true });
      },
      fail: () => {
        wx.showModal({
          title: "权限提示",
          content: "需要摄像头权限才能进行人脸识别，请在设置中开启",
          confirmText: "去设置",
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  },

  onCameraError(e) {
    console.error("摄像头错误:", e.detail);
    wx.showToast({
      title: "摄像头打开失败",
      icon: "none"
    });
  },

  takePhoto() {
    if (this.data.recognizing) return;

    this.setData({
      recognizing: true,
      recognizedPerson: null,
      noMatch: false,
      errorMessage: ""
    });

    const ctx = wx.createCameraContext();

    ctx.takePhoto({
      quality: "high",
      success: async (res) => {
        const tempImagePath = res.tempImagePath;
        await this.recognizeFace(tempImagePath);
      },
      fail: (err) => {
        console.error("拍照失败:", err);
        wx.showToast({
          title: "拍照失败",
          icon: "none"
        });
        this.setData({ recognizing: false });
      }
    });
  },

  async recognizeFace(tempFilePath) {
    try {
      wx.showLoading({ title: "识别中...", mask: true });

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `face-photos/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
        filePath: tempFilePath
      });

      if (!uploadRes.fileID) {
        throw new Error("上传失败");
      }

      const result = await recognizeFaceAPI(uploadRes.fileID);

      wx.hideLoading();

      if (result.success && result.match) {
        this.setData({
          recognizing: false,
          recognizedPerson: result.match,
          displayAvatar: result.match.avatar || result.match.facePhoto || "",
          noMatch: false
        });
      } else {
        this.setData({
          recognizing: false,
          recognizedPerson: null,
          displayAvatar: "",
          noMatch: true,
          errorMessage: result.message || "未识别到家庭成员"
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error("人脸识别失败:", error);

      const message = (error && error.message) || "识别失败，请重试";
      const isNoMatch =
        message.includes("未识别到家庭成员") ||
        message.includes("暂无家庭成员上传人脸照片");

      this.setData({
        recognizing: false,
        recognizedPerson: null,
        displayAvatar: "",
        noMatch: true,
        errorMessage: message
      });

      if (!isNoMatch) {
        wx.showToast({
          title: "识别失败",
          icon: "none"
        });
      }
    }
  },

  retry() {
    this.setData({
      recognizedPerson: null,
      displayAvatar: "",
      noMatch: false,
      errorMessage: ""
    });
  }
});
