// pages/family/upload.js
const { addMemoryAPI } = require("../../api/user");

Page({

  data: {
    fileUrl: "",
    cloudUrl: "",
    type: "",
    title: "",
    story: "",
    year: new Date().getFullYear(),
    person: "",
    uploading: false
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        this.setData({
          fileUrl: res.tempFilePaths[0],
          type: "photo"
        });
      }
    });
  },

  chooseVideo() {
    wx.chooseVideo({
      success: (res) => {
        this.setData({
          fileUrl: res.tempFilePath,
          type: "video"
        });
      }
    });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onStoryInput(e) {
    this.setData({ story: e.detail.value });
  },

  onYearChange(e) {
    this.setData({ year: parseInt(e.detail.value) || new Date().getFullYear() });
  },

  onPersonInput(e) {
    this.setData({ person: e.detail.value });
  },

  /**
   * 上传文件到云存储
   */
  uploadToCloud(tempFilePath) {
    return new Promise((resolve, reject) => {
      const cloudPath = `memories/${Date.now()}-${Math.random().toString(36).substr(2, 9)}${tempFilePath.match(/\.[^.]+$/)[0] || '.jpg'}`;

      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  /**
   * 提交记忆
   */
  async submitMemory() {
    const { title, story, year, person, fileUrl, type } = this.data;

    // 验证必填项
    if (!title.trim()) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }
    if (!story.trim()) {
      wx.showToast({ title: "请写下这段回忆", icon: "none" });
      return;
    }

    this.setData({ uploading: true });

    try {
      let cloudUrl = "";

      // 如果有文件，先上传到云存储
      if (fileUrl) {
        wx.showLoading({ title: "上传文件中..." });
        cloudUrl = await this.uploadToCloud(fileUrl);
        wx.hideLoading();
      }

      // 保存记忆到数据库
      wx.showLoading({ title: "保存中..." });
      await addMemoryAPI({
        title: title.trim(),
        story: story.trim(),
        year: year,
        person: person.trim(),
        type: type || "daily",
        img: cloudUrl || ""
      });

      wx.hideLoading();
      wx.showToast({ title: "上传成功", icon: "success" });

      // 重置表单
      this.setData({
        fileUrl: "",
        cloudUrl: "",
        type: "",
        title: "",
        story: "",
        year: new Date().getFullYear(),
        person: "",
        uploading: false
      });

    } catch (error) {
      wx.hideLoading();
      console.error("上传失败:", error);
      wx.showToast({
        title: error.message || "上传失败",
        icon: "none"
      });
      this.setData({ uploading: false });
    }
  },

  /**
   * 删除已选择的文件
   */
  removeFile() {
    this.setData({
      fileUrl: "",
      type: ""
    });
  }

});
