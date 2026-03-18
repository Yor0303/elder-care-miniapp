const { getMemoriesAPI } = require("../../api/user");

// 记忆类型配置
const MEMORY_TYPES = {
  family: "family",
  travel: "travel",
  festival: "festival",
  daily: "daily"
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

    loading: false,
    errorMsg: ""
  },

  onLoad(options) {
    this.loadMemories(options);
  },

  /**
   * 从云端加载记忆数�?
   */
  async loadMemories(options) {
    this.setData({ loading: true, errorMsg: "" });

    try {
      const queryParams = {};
      if (options.person) {
        queryParams.person = options.person;
      }

      const memories = await getMemoriesAPI(queryParams);

      this.setData({
        memories,
        list: memories,
        loading: false
      });

    } catch (error) {
      console.error("加载记忆数据失败:", error);
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

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadMemories({});
    wx.stopPullDownRefresh();
  },

  // 打开故事卡片
  openMemory(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showStory: true,
      currentMemory: item
    });
  },

  closeStory() {
    this.setData({
      showStory: false
    });
  },

  // 打开筛�?
  openFilter() {
    this.setData({
      showFilter: true
    });
  },

  closeFilter() {
    this.setData({
      showFilter: false
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

  /**
   * 按年代筛�?
   */
  filterDecade(e) {
    const value = e.currentTarget.dataset.value;
    const result = this.data.memories.filter(item => item.decade === value);

    this.setData({
      list: result,
      showFilter: false
    });
  },

  /**
   * 按类型筛�?
   */
  filterType(e) {
    const value = e.currentTarget.dataset.value;
    const result = this.data.memories.filter(item => item.type === value);

    this.setData({
      list: result,
      showFilter: false
    });
  },

  resetFilter() {
    this.setData({
      list: this.data.memories,
      showFilter: false
    });
  },

  startStory() {
    let index = 0;

    const timer = setInterval(() => {
      if (index >= this.data.list.length) {
        clearInterval(timer);
        return;
      }

      wx.pageScrollTo({
        scrollTop: index * 350,
        duration: 800
      });

      index++;
    }, 4000);
  }

});

