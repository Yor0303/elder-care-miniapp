// pages/family/memory-edit.js
const {
  getMemoriesAPI,
  addMemoryAPI,
  updateMemoryAPI,
  deleteMemoryAPI,
  getPersonListAPI
} = require("../../api/user");

Page({
  data: {
    isEdit: false,
    memoryId: "",

    title: "",
    story: "",
    year: "",
    person: "",
    img: "",
    type: "",

    typeOptions: ["family", "travel", "festival", "daily"],
    typeLabels: {
      family: "家庭",
      travel: "旅行",
      festival: "节日",
      daily: "日常"
    },
    showTypePicker: false,

    personOptions: [],
    personIndex: -1,

    fileList: [],
    saving: false
  },

  onLoad(options) {
    this.loadPersonOptions();

    const memoryId = options.id || options.memoryId;
    if (memoryId) {
      this.setData({ isEdit: true, memoryId });
      this.loadMemoryDetail(memoryId);
    }
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

  async loadMemoryDetail(memoryId) {
    try {
      wx.showLoading({ title: "加载中" });
      const memories = await getMemoriesAPI({});
      const memory = memories.find((m) => m.id === memoryId);

      if (memory) {
        this.setData({
          title: memory.title || "",
          story: memory.story || "",
          year: memory.year ? String(memory.year) : "",
          person: memory.person || "",
          type: memory.type || "",
          img: memory.img || "",
          fileList: memory.img ? [{ url: memory.img }] : []
        });
        this.syncPersonIndex(memory.person);
      }

      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  // 输入事件
  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onStoryInput(e) { this.setData({ story: e.detail.value }); },
  onYearInput(e) { this.setData({ year: e.detail.value }); },

  onPersonChange(e) {
    const index = Number(e.detail.value);
    const person = this.data.personOptions[index] || "";
    this.setData({ personIndex: index, person });
  },

  // 类型选择
  showTypePicker() { this.setData({ showTypePicker: true }); },
  hideTypePicker() { this.setData({ showTypePicker: false }); },

  onTypeSelect(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({ type, showTypePicker: false });
  },

  // 选择图片
  chooseImage() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        this.setData({
          img: res.tempFilePaths[0],
          fileList: [{ url: res.tempFilePaths[0] }]
        });
      }
    });
  },

  removeImage() {
    this.setData({
      img: "",
      fileList: []
    });
  },

  // 上传图片到云存储
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

  // 保存
  async save() {
    const { title, story, year, person, type, img, isEdit, memoryId, saving } = this.data;

    if (!title.trim()) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }
    if (!story.trim()) {
      wx.showToast({ title: "请写下这段回忆", icon: "none" });
      return;
    }

    if (saving) return;
    this.setData({ saving: true });

    try {
      let cloudUrl = img;

      // 如果是本地临时文件，先上传
      if (img && img.startsWith("wxfile://")) {
        wx.showLoading({ title: "上传图片..." });
        cloudUrl = await this.uploadToCloud(img);
      }

      wx.showLoading({ title: "保存中..." });

      const parsedYear = parseInt(year, 10);
      const data = {
        title: title.trim(),
        story: story.trim(),
        year: Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear(),
        person: person.trim(),
        type: type || "daily",
        img: cloudUrl || ""
      };

      if (isEdit) {
        await updateMemoryAPI({ memoryId, ...data });
      } else {
        await addMemoryAPI(data);
      }

      wx.hideLoading();
      wx.showToast({ title: "保存成功", icon: "success" });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }

    this.setData({ saving: false });
  },

  // 删除
  delete() {
    wx.showModal({
      title: "确认删除",
      content: "删除后无法恢复，确定要删除吗？",
      success: async (res) => {
        if (res.confirm) {
          try {
            await deleteMemoryAPI(this.data.memoryId);
            wx.showToast({ title: "删除成功", icon: "success" });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (error) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  }
});
