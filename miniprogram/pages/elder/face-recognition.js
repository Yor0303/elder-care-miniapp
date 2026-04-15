// pages/elder/face-recognition.js
const { recognizeFaceAPI } = require("../../api/user");
const {
  isPreviewMode,
  previewFamilyMembers,
  promptPreviewLogin
} = require("../../utils/family-preview");
const FACE_UPLOAD_TIMEOUT = 15000;
const FACE_RECOGNITION_TIMEOUT = 20000;

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);
    })
  ]);
}

function normalizeDecodeErrorMessage(message = "") {
  if (message.includes("图片解码失败") || message.includes("ImageDecodeFailed")) {
    return "图片解码失败，请使用光线充足环境重新拍摄，家属人脸照建议重新上传 JPG 或 PNG 格式的清晰正脸照。";
  }
  if (message.includes("识别超时")) {
    return "识别超时，请重新部署云函数后重试。若云函数超时时间仍为 3 秒，建议调大到 15-20 秒。";
  }
  return message;
}

function isCloudFileId(value) {
  return typeof value === "string" && value.startsWith("cloud://");
}

function resolveTempFileURL(fileID) {
  if (!isCloudFileId(fileID)) {
    return Promise.resolve(fileID || "");
  }

  return wx.cloud
    .getTempFileURL({ fileList: [fileID] })
    .then((res) => {
      const item = res && res.fileList && res.fileList[0];
      return (item && (item.tempFileURL || item.tempFileUrl)) || fileID;
    })
    .catch(() => fileID);
}

Page({
  data: {
    previewMode: false,
    cameraAuthorized: false,
    recognizing: false,
    recognizedPerson: null,
    displayAvatar: "",
    noMatch: false,
    errorMessage: ""
  },

  onLoad(options = {}) {
    const previewMode = isPreviewMode(options);
    if (previewMode) {
      const recognizedPerson = (previewFamilyMembers && previewFamilyMembers[0]) || null;
      this.setData({
        previewMode,
        cameraAuthorized: false,
        recognizedPerson,
        displayAvatar: recognizedPerson ? (recognizedPerson.avatar || "") : "",
        noMatch: false,
        errorMessage: ""
      });
      return;
    }

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
    if (this.data.previewMode) {
      promptPreviewLogin("人脸识别");
      return;
    }
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
    if (this.data.previewMode) {
      promptPreviewLogin("人脸识别");
      return;
    }
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

      let uploadPath = tempFilePath;
      try {
        const compressed = await wx.compressImage({
          src: tempFilePath,
          quality: 80
        });
        if (compressed && compressed.tempFilePath) {
          uploadPath = compressed.tempFilePath;
        }
      } catch (_) {
        uploadPath = tempFilePath;
      }

      const uploadRes = await withTimeout(
        wx.cloud.uploadFile({
          cloudPath: `face-photos/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
          filePath: uploadPath
        }),
        FACE_UPLOAD_TIMEOUT,
        "上传超时，请检查网络后重试"
      );

      if (!uploadRes.fileID) {
        throw new Error("上传失败");
      }

      const result = await withTimeout(
        recognizeFaceAPI(uploadRes.fileID),
        FACE_RECOGNITION_TIMEOUT,
        "识别超时"
      );

      if (result.success && result.match) {
        const displayAvatar = await resolveTempFileURL(result.match.facePhoto || result.match.avatar || "");
        this.setData({
          recognizing: false,
          recognizedPerson: result.match,
          displayAvatar,
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
      console.error("人脸识别失败:", error);

      const message = normalizeDecodeErrorMessage((error && error.message) || "识别失败，请重试");
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
    } finally {
      wx.hideLoading();
    }
  },

  retry() {
    if (this.data.previewMode) {
      promptPreviewLogin("人脸识别");
      return;
    }
    this.setData({
      recognizedPerson: null,
      displayAvatar: "",
      noMatch: false,
      errorMessage: ""
    });
  }
});
