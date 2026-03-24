const { getMemoriesAPI } = require("../../api/user");

const TYPE_LABELS = {
  family: "家庭",
  travel: "旅行",
  festival: "节日",
  daily: "日常",
  medical: "医疗"
};

Page({
  data: {
    showFilter: false,
    showDecade: false,
    showType: false,
    showStory: false,
    currentMemory: {},
    memories: [],
    list: [],
    decadeOptions: [],
    typeOptions: [],
    activeDecade: "",
    activeType: "",
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
          decade: item.decade || "",
          type: item.type || "daily",
          typeLabel: TYPE_LABELS[item.type] || "其他",
          img: item.img || "/assets/images/family.jpg",
          title: item.title || "未命名回忆",
          story: item.story || "暂无故事内容",
          person: item.person || "未标注人物"
        }))
        .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));

      const decadeOptions = [...new Set(normalized.map((item) => item.decade).filter(Boolean))];
      const typeOptions = [...new Set(normalized.map((item) => item.type).filter(Boolean))];

      this.setData({
        memories: normalized,
        list: this.applyFilters(normalized, this.data.activeDecade, this.data.activeType),
        decadeOptions,
        typeOptions,
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
      showStory: true,
      currentMemory: item || {}
    });
  },

  closeStory() {
    this.setData({
      showStory: false,
      currentMemory: {}
    });
  },

  openFilter() {
    this.setData({
      showFilter: true
    });
  },

  closeFilter() {
    this.setData({
      showFilter: false,
      showDecade: false,
      showType: false
    });
  },

  toggleDecade() {
    this.setData({
      showDecade: !this.data.showDecade,
      showType: false
    });
  },

  toggleType() {
    this.setData({
      showType: !this.data.showType,
      showDecade: false
    });
  },

  filterDecade(e) {
    const value = e.currentTarget.dataset.value || "";
    this.setData({
      activeDecade: value,
      list: this.applyFilters(this.data.memories, value, this.data.activeType),
      showFilter: false,
      showDecade: false
    });
  },

  filterType(e) {
    const value = e.currentTarget.dataset.value || "";
    this.setData({
      activeType: value,
      list: this.applyFilters(this.data.memories, this.data.activeDecade, value),
      showFilter: false,
      showType: false
    });
  },

  resetFilter() {
    this.setData({
      activeDecade: "",
      activeType: "",
      list: this.data.memories,
      showFilter: false,
      showDecade: false,
      showType: false
    });
  },

  startStory() {
    if (!this.data.list.length) {
      wx.showToast({
        title: "暂无回忆可播放",
        icon: "none"
      });
      return;
    }

    let index = 0;
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      if (index >= this.data.list.length) {
        clearInterval(this.timer);
        this.timer = null;
        return;
      }

      wx.pageScrollTo({
        scrollTop: index * 360,
        duration: 800
      });

      index += 1;
    }, 4000);
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
});
