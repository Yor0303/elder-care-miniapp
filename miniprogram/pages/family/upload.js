// pages/family/upload.js
const { addMemoryAPI, getPersonListAPI } = require("../../api/user");

Page({
  data: {
    fileUrl: "",
    cloudUrl: "",
    type: "",
    title: "",
    story: "",
    year: new Date().getFullYear(),
    person: "",
    personOptions: [],
    personIndex: -1,
    uploading: false
  },

  onLoad() {
    this.loadPersonOptions();
  },

  async loadPersonOptions() {
    try {
      const persons = await getPersonListAPI();
      const names = (persons || [])
        .map((item) => (item && item.name ? item.name.trim() : ""))
        .filter(Boolean);
      const options = this.normalizePersonOptions(names);
      this.setData({ personOptions: options });
      this.syncPersonIndex(this.data.person, options);
    } catch (error) {
      const options = this.normalizePersonOptions([]);
      this.setData({ personOptions: options });
      this.syncPersonIndex(this.data.person, options);
    }
  },

  normalizePersonOptions(names) {
    const result = [];
    const seen = new Set();
    const base = ["本人", ...names];

    base.forEach((name) => {
      const value = (name || "").trim();
      if (!value) return;
      if (seen.has(value)) return;
      seen.add(value);
      result.push(value);
    });

    return result;
  },

  syncPersonIndex(personValue, options = this.data.personOptions) {
    const person = (personValue || "").trim();
    if (!options || options.length === 0) {
      this.setData({ personIndex: -1 });
      return;
    }

    let index = options.findIndex((name) => name === person);
    if (person && index === -1) {
      const nextOptions = [person, ...options.filter((name) => name !== person)];
      index = 0;
      this.setData({ personOptions: nextOptions, personIndex: index });
      return;
    }

    this.setData({ personIndex: person ? index : -1 });
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
    this.setData({ year: parseInt(e.detail.value, 10) || new Date().getFullYear() });
  },

  onPersonChange(e) {
    const index = Number(e.detail.value);
    const person = this.data.personOptions[index] || "";
    this.setData({ personIndex: index, person });
  },

  /**
   * 上传文件到云存储
   */
  uploadToCloud(tempFilePath) {
    return new Promise((resolve, reject) => {
      const cloudPath = `memories/${Date.now()}-${Math.random().toString(36).substr(2, 9)}${tempFilePath.match(/\.[^.]+$/)[0] || ".jpg"}`;

      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  /**
   * 提交回忆
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

      // 保存回忆到数据库
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
        personIndex: -1,
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
