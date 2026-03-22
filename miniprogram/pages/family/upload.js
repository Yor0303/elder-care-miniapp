const { addMemoryAPI, getPersonListAPI } = require("../../api/user");

Page({
  data: {
    fileUrl: "",
    cloudUrl: "",
    type: "",
    title: "",
    story: "",
    year: "",
    person: "",
    personOptions: [],
    personIndex: -1,
    uploading: false
  },

  onLoad() {
    this.loadPersons();
  },

  async loadPersons() {
    try {
      const persons = await getPersonListAPI();
      const personOptions = Array.isArray(persons) ? persons.map((item) => item.name) : [];
      this.setData({ personOptions });
      this.syncPersonIndex(this.data.person, personOptions);
    } catch (error) {
      console.error("加载人物列表失败:", error);
      wx.showToast({
        title: "人物加载失败",
        icon: "none"
      });
    }
  },

  syncPersonIndex(personValue, options = this.data.personOptions) {
    const person = (personValue || "").trim();

    if (!options || options.length === 0) {
      this.setData({ personIndex: -1 });
      return;
    }

    const index = options.findIndex((name) => name === person);
    this.setData({
      personIndex: index
    });
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
    this.setData({ year: e.detail.value });
  },

  onPersonChange(e) {
    const index = Number(e.detail.value);
    const person = this.data.personOptions[index] || "";
    this.setData({
      personIndex: index,
      person
    });
  },

  removeFile() {
    this.setData({
      fileUrl: "",
      type: ""
    });
  },

  uploadToCloud(tempFilePath) {
    return new Promise((resolve, reject) => {
      const extMatch = tempFilePath.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : ".jpg";
      const cloudPath = `memories/${Date.now()}-${Math.random().toString(36).slice(2, 11)}${ext}`;

      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  async submitMemory() {
    const { title, story, year, person, fileUrl, type, uploading } = this.data;

    if (!title.trim()) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }

    if (!story.trim()) {
      wx.showToast({ title: "请输入回忆内容", icon: "none" });
      return;
    }

    if (uploading) {
      return;
    }

    this.setData({ uploading: true });

    try {
      let cloudUrl = "";

      if (fileUrl) {
        wx.showLoading({ title: "上传中..." });
        cloudUrl = await this.uploadToCloud(fileUrl);
        wx.hideLoading();
      }

      wx.showLoading({ title: "保存中..." });
      await addMemoryAPI({
        title: title.trim(),
        story: story.trim(),
        year: parseInt(year, 10) || new Date().getFullYear(),
        person: person.trim(),
        type: type || "daily",
        img: cloudUrl || ""
      });

      wx.hideLoading();
      wx.showToast({ title: "保存成功", icon: "success" });

      this.setData({
        fileUrl: "",
        cloudUrl: "",
        type: "",
        title: "",
        story: "",
        year: "",
        person: "",
        personIndex: -1,
        uploading: false
      });
    } catch (error) {
      wx.hideLoading();
      console.error("上传回忆失败:", error);
      wx.showToast({
        title: error.message || "保存失败",
        icon: "none"
      });
      this.setData({ uploading: false });
    }
  }
});
