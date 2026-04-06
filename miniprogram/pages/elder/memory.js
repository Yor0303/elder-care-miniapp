const { getMemoriesAPI } = require("../../api/user");

const TYPE_LABELS = {
  family: "家庭",
  travel: "旅行",
  festival: "节日",
  daily: "日常",
  medical: "医疗",
  childhood: "童年",
  school: "校园",
  work: "工作",
  hometown: "家乡",
  friend: "朋友",
  friendship: "朋友",
  wedding: "婚礼",
  birthday: "生日",
  celebration: "庆祝",
  milestone: "重要时刻",
  portrait: "照片",
  life: "生活",
  holiday: "假日",
  photo: "照片",
  video: "视频"
};

const TYPE_ORDER = [
  "family",
  "childhood",
  "school",
  "friend",
  "friendship",
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
  "portrait",
  "photo",
  "video"
];

function getTypeLabel(type) {
  return TYPE_LABELS[type] || "其他";
}

function normalizeYear(value) {
  const match = String(value || "").match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function normalizeDecade(decade, year) {
  if (decade !== null && decade !== undefined && decade !== "") {
    return String(decade).replace(/[^\d]/g, "").slice(0, 4);
  }

  const numericYear = normalizeYear(year);
  if (!numericYear) {
    return "";
  }

  return String(Math.floor(numericYear / 10) * 10);
}

Page({
  data: {
    showFilter: false,
    showDetail: false,
    expandedSection: "",
    currentMemory: {},
    memories: [],
    list: [],
    decadeOptions: [],
    typeOptions: [],
    activeDecade: "",
    activeType: "",
    activeTypeLabel: "",
    loading: false,
    errorMsg: "",
    queryPerson: ""
  },

  onLoad(options = {}) {
    this.setData({
      queryPerson: options.person || ""
    });
    this.loadMemories();
  },

  async loadMemories() {
    this.setData({ loading: true, errorMsg: "" });

    try {
      const queryParams = {};
      if (this.data.queryPerson) {
        queryParams.person = this.data.queryPerson;
      }

      const memoriesRaw = await getMemoriesAPI(queryParams);
      const memories = Array.isArray(memoriesRaw)
        ? memoriesRaw
        : (memoriesRaw && Array.isArray(memoriesRaw.data) ? memoriesRaw.data : []);

      const normalized = memories
        .map((item) => ({
          ...item,
          year: item.year || "",
          decade: normalizeDecade(item.decade, item.year),
          type: item.type || "daily",
          typeLabel: getTypeLabel(item.type || "daily"),
          img: item.img || "/assets/images/family.jpg",
          title: item.title || "未命名回忆",
          story: item.story || "暂无故事内容",
          person: item.person || "未标注人物"
        }))
        .sort((a, b) => normalizeYear(b.year) - normalizeYear(a.year));

      const decadeOptions = [...new Set(normalized.map((item) => item.decade).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
      const typeOptions = [...new Set(normalized.map((item) => item.type).filter(Boolean))]
        .sort((a, b) => {
          const aIndex = TYPE_ORDER.indexOf(a);
          const bIndex = TYPE_ORDER.indexOf(b);
          const normalizedA = aIndex === -1 ? TYPE_ORDER.length : aIndex;
          const normalizedB = bIndex === -1 ? TYPE_ORDER.length : bIndex;
          if (normalizedA !== normalizedB) {
            return normalizedA - normalizedB;
          }
          return getTypeLabel(a).localeCompare(getTypeLabel(b), "zh-CN");
        })
        .map((type) => ({
          value: type,
          label: getTypeLabel(type)
        }));

      this.setData({
        memories: normalized,
        list: this.applyFilters(normalized, this.data.activeDecade, this.data.activeType),
        decadeOptions,
        typeOptions,
        activeTypeLabel: getTypeLabel(this.data.activeType || ""),
        loading: false
      });
    } catch (error) {
      console.error("加载回忆数据失败:", error);
      this.setData({
        loading: false,
        errorMsg: error.message || "加载失败，请重试"
      });

      wx.showToast({
        title: "加载失败",
        icon: "none"
      });
    }
  },

  applyFilters(memories, decade, type) {
    return (memories || []).filter((item) => {
      if (decade && item.decade !== decade) {
        return false;
      }
      if (type && item.type !== type) {
        return false;
      }
      return true;
    });
  },

  async onPullDownRefresh() {
    await this.loadMemories();
    wx.stopPullDownRefresh();
  },

  openMemory(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showDetail: true,
      currentMemory: item || {}
    });
  },

  closeDetail() {
    this.setData({
      showDetail: false,
      currentMemory: {}
    });
  },

  openFilter() {
    this.setData({
      showFilter: true,
      expandedSection: ""
    });
  },

  closeFilter() {
    this.setData({
      showFilter: false,
      expandedSection: ""
    });
  },

  toggleSection(e) {
    const section = e.currentTarget.dataset.section || "";
    this.setData({
      expandedSection: this.data.expandedSection === section ? "" : section
    });
  },

  filterDecade(e) {
    const value = e.currentTarget.dataset.value || "";
    this.setData({
      activeDecade: value,
      list: this.applyFilters(this.data.memories, value, this.data.activeType)
    });
  },

  filterType(e) {
    const value = e.currentTarget.dataset.value || "";
    this.setData({
      activeType: value,
      activeTypeLabel: getTypeLabel(value),
      list: this.applyFilters(this.data.memories, this.data.activeDecade, value)
    });
  },

  resetFilter() {
    this.setData({
      activeDecade: "",
      activeType: "",
      activeTypeLabel: "",
      list: this.data.memories,
      showFilter: false,
      expandedSection: ""
    });
  },

  onUnload() {
  }
});
