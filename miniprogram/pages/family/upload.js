const {
  addMemoryAPI,
  getPersonListAPI,
  getElderInfoAPI,
  createMemoryPairAPI
} = require("../../api/user");

const MEMORY_TYPE_LABELS = {
  family: "家庭",
  childhood: "童年",
  school: "校园",
  friend: "朋友",
  travel: "旅行",
  festival: "节日",
  birthday: "生日",
  wedding: "婚礼",
  celebration: "庆祝",
  work: "工作",
  hometown: "家乡",
  medical: "医疗",
  daily: "日常",
  life: "生活",
  holiday: "假日",
  milestone: "重要时刻",
  portrait: "照片"
};

const MEMORY_TYPE_OPTIONS = [
  "family",
  "childhood",
  "school",
  "friend",
  "travel",
  "festival",
  "birthday",
  "wedding",
  "celebration",
  "work",
  "hometown",
  "medical",
  "daily",
  "life",
  "holiday",
  "milestone",
  "portrait"
];

function inferPersonRole(person, role) {
  if (role === "self" || role === "family") {
    return role;
  }

  const normalizedPerson = (person || "").trim();
  return ["本人", "自己", "我"].includes(normalizedPerson) ? "self" : (normalizedPerson ? "family" : "");
}

function buildPersonOptions(persons, elderName) {
  const options = [
    {
      label: elderName ? `本人（${elderName}）` : "本人",
      value: "本人",
      role: "self"
    }
  ];

  (Array.isArray(persons) ? persons : []).forEach((item) => {
    const name = item && item.name ? item.name.trim() : "";
    if (!name || name === "本人") {
      return;
    }

    options.push({
      label: name,
      value: name,
      role: "family"
    });
  });

  return options;
}

Page({
  data: {
    mode: "single",
    fileUrl: "",
    cloudUrl: "",
    mediaType: "",
    memoryType: "",
    typeOptions: MEMORY_TYPE_OPTIONS,
    typeLabels: MEMORY_TYPE_LABELS,
    showTypePicker: false,
    title: "",
    story: "",
    eventDate: "",
    person: "",
    personRole: "",
    personOptions: [],
    personIndex: -1,
    uploading: false,
    leftFileUrl: "",
    rightFileUrl: "",
    leftLabel: "",
    rightLabel: "",
    notes: "",
    pairUploading: false
  },

  onLoad() {
    this.loadPersons();
  },

  switchToSingle() {
    this.setData({ mode: "single" });
  },

  switchToPair() {
    this.setData({ mode: "pair" });
  },

  async loadPersons() {
    try {
      const [persons, elder] = await Promise.all([getPersonListAPI(), getElderInfoAPI()]);
      const elderName = elder && elder.name ? elder.name.trim() : "";
      const personOptions = buildPersonOptions(persons, elderName);
      this.setData({ personOptions });
      this.syncPersonIndex(this.data.person, this.data.personRole, personOptions);
    } catch (error) {
      console.error("加载人物列表失败:", error);
      wx.showToast({
        title: "人物加载失败",
        icon: "none"
      });
    }
  },

  syncPersonIndex(personValue, personRole = this.data.personRole, options = this.data.personOptions) {
    const person = (personValue || "").trim();
    const role = inferPersonRole(person, personRole);

    if (!options || options.length === 0) {
      this.setData({ personIndex: -1 });
      return;
    }

    const index = options.findIndex((item) => item.value === person && item.role === role);
    this.setData({ personIndex: index });
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        this.setData({
          fileUrl: res.tempFilePaths[0],
          mediaType: "photo"
        });
      }
    });
  },

  chooseVideo() {
    wx.chooseVideo({
      success: (res) => {
        this.setData({
          fileUrl: res.tempFilePath,
          mediaType: "video"
        });
      }
    });
  },

  chooseLeftImage() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        this.setData({ leftFileUrl: res.tempFilePaths[0] });
      }
    });
  },

  chooseRightImage() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        this.setData({ rightFileUrl: res.tempFilePaths[0] });
      }
    });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onStoryInput(e) {
    this.setData({ story: e.detail.value });
  },

  onDateChange(e) {
    this.setData({ eventDate: e.detail.value });
  },

  onPersonChange(e) {
    const index = Number(e.detail.value);
    const target = this.data.personOptions[index];
    this.setData({
      personIndex: index,
      person: target ? target.value : "",
      personRole: target ? target.role : ""
    });
  },

  noop() {},

  showTypePicker() {
    this.setData({ showTypePicker: true });
  },

  hideTypePicker() {
    this.setData({ showTypePicker: false });
  },

  onTypeSelect(e) {
    const type = e.currentTarget.dataset.type || "";
    this.setData({
      memoryType: type,
      showTypePicker: false
    });
  },

  removeFile() {
    this.setData({
      fileUrl: "",
      mediaType: ""
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

  uploadPairToCloud(tempFilePath) {
    return new Promise((resolve, reject) => {
      const extMatch = tempFilePath.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : ".jpg";
      const cloudPath = `memory-pairs/${Date.now()}-${Math.random().toString(36).slice(2, 11)}${ext}`;
      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  async submitMemory() {
    const { title, story, eventDate, person, personRole, fileUrl, memoryType, uploading } = this.data;

    if (!title.trim()) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }

    if (!story.trim()) {
      wx.showToast({ title: "请输入回忆内容", icon: "none" });
      return;
    }

    if (!eventDate) {
      wx.showToast({ title: "请选择回忆日期", icon: "none" });
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
        eventDate,
        year: Number(eventDate.slice(0, 4)),
        person: person.trim(),
        personRole: inferPersonRole(person.trim(), personRole),
        type: memoryType || "daily",
        img: cloudUrl || ""
      });

      wx.hideLoading();
      wx.showToast({ title: "保存成功", icon: "success" });

      this.setData({
        fileUrl: "",
        cloudUrl: "",
        mediaType: "",
        memoryType: "",
        title: "",
        story: "",
        eventDate: "",
        person: "",
        personRole: "",
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
  },

  onLeftLabelInput(e) {
    this.setData({ leftLabel: e.detail.value });
  },

  onRightLabelInput(e) {
    this.setData({ rightLabel: e.detail.value });
  },

  onNotesInput(e) {
    this.setData({ notes: e.detail.value });
  },

  async submitPair() {
    const { leftFileUrl, rightFileUrl, leftLabel, rightLabel, pairUploading, notes } = this.data;
    if (!leftFileUrl || !rightFileUrl) {
      wx.showToast({ title: "请先选择两张图片", icon: "none" });
      return;
    }
    if (pairUploading) return;
    this.setData({ pairUploading: true });
    try {
      wx.showLoading({ title: "上传中..." });
      const [leftId, rightId] = await Promise.all([
        this.uploadPairToCloud(leftFileUrl),
        this.uploadPairToCloud(rightFileUrl)
      ]);
      wx.hideLoading();

      wx.showLoading({ title: "保存中..." });
      await createMemoryPairAPI({
        leftImgFileID: leftId,
        rightImgFileID: rightId,
        leftLabel: (leftLabel || "").trim(),
        rightLabel: (rightLabel || "").trim(),
        notes: (notes || "").trim()
      });
      wx.hideLoading();
      wx.showToast({ title: "保存成功", icon: "success" });
      this.setData({
        leftFileUrl: "",
        rightFileUrl: "",
        leftLabel: "",
        rightLabel: "",
        notes: "",
        pairUploading: false
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || "保存失败", icon: "none" });
      this.setData({ pairUploading: false });
    }
  }
});
