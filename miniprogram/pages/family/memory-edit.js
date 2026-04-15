const {
  getMemoriesAPI,
  getPersonListAPI,
  getElderInfoAPI,
  addMemoryAPI,
  updateMemoryAPI,
  deleteMemoryAPI
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

function normalizeDateValue(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  return "";
}

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

function shouldUploadImage(filePath = "") {
  const value = String(filePath || "").trim();
  if (!value) return false;
  if (value.startsWith("cloud://")) return false;
  if (value.startsWith("http://tmp/")) return true;
  if (value.startsWith("https://tmp/")) return true;
  if (value.startsWith("wxfile://")) return true;
  if (value.startsWith("wdfile://")) return true;
  return !/^https?:\/\//i.test(value);
}

Page({
  data: {
    isEdit: false,
    memoryId: "",
    title: "",
    story: "",
    eventDate: "",
    person: "",
    personRole: "",
    img: "",
    type: "",
    typeOptions: MEMORY_TYPE_OPTIONS,
    typeLabels: MEMORY_TYPE_LABELS,
    showTypePicker: false,
    typeActionItems: MEMORY_TYPE_OPTIONS.map((item) => ({
      text: MEMORY_TYPE_LABELS[item],
      value: item
    })),
    personOptions: [],
    personIndex: -1,
    fileList: [],
    saving: false,
    showDeleteDialog: false,
    deleteDialogButtons: [
      { text: "取消", type: "default", value: "cancel" },
      { text: "删除", type: "warn", value: "confirm" }
    ]
  },

  noop() {},

  onLoad(options = {}) {
    this.loadPersons();

    const memoryId = options.id || options.memoryId;
    if (memoryId) {
      this.setData({ isEdit: true, memoryId });
      this.loadMemoryDetail(memoryId);
    }
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
      wx.showToast({ title: "人物加载失败", icon: "none" });
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

  async loadMemoryDetail(memoryId) {
    try {
      wx.showLoading({ title: "加载中..." });
      const memoriesRaw = await getMemoriesAPI({});
      const memories = Array.isArray(memoriesRaw)
        ? memoriesRaw
        : (memoriesRaw && Array.isArray(memoriesRaw.data) ? memoriesRaw.data : []);
      const memory = memories.find((item) => item.id === memoryId);

      if (memory) {
        const personRole = inferPersonRole(memory.person, memory.personRole);
        const previewUrl = await resolveTempFileURL(memory.img || "");
        this.setData({
          title: memory.title || "",
          story: memory.story || "",
          eventDate: normalizeDateValue(memory.eventDate),
          person: memory.person || "",
          personRole,
          type: memory.type || "",
          img: memory.img || "",
          fileList: previewUrl ? [{ url: previewUrl }] : []
        });
        this.syncPersonIndex(memory.person, personRole);
      }

      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: "加载失败", icon: "none" });
    }
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

  showTypePicker() {
    this.setData({ showTypePicker: true });
  },

  hideTypePicker() {
    this.setData({ showTypePicker: false });
  },

  onTypeSelect(e) {
    const type = (e.detail && e.detail.value) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.type);
    this.setData({ type: type || "", showTypePicker: false });
  },

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

  async save() {
    const { title, story, eventDate, person, personRole, type, img, isEdit, memoryId, saving } = this.data;

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
    if (saving) {
      return;
    }

    this.setData({ saving: true });

    try {
      let cloudUrl = img;

      if (shouldUploadImage(img)) {
        wx.showLoading({ title: "上传图片中..." });
        cloudUrl = await this.uploadToCloud(img);
      }

      wx.showLoading({ title: "保存中..." });
      const data = {
        title: title.trim(),
        story: story.trim(),
        eventDate,
        year: Number(eventDate.slice(0, 4)),
        person: person.trim(),
        personRole: inferPersonRole(person.trim(), personRole),
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
      }, 1200);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }

    this.setData({ saving: false });
  },

  delete() {
    this.setData({ showDeleteDialog: true });
  },

  closeDeleteDialog() {
    this.setData({ showDeleteDialog: false });
  },

  async onDeleteDialogTap(e) {
    const value = e.detail && e.detail.value;
    if (value !== "confirm") {
      this.closeDeleteDialog();
      return;
    }

    try {
      await deleteMemoryAPI(this.data.memoryId);
      this.closeDeleteDialog();
      wx.showToast({ title: "删除成功", icon: "success" });
      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
    } catch (error) {
      this.closeDeleteDialog();
      wx.showToast({ title: "删除失败", icon: "none" });
    }
  }
});
