const { getMemoriesAPI } = require("../../api/user");

// 记忆类型配置
const MEMORY_TYPES = {
  family: "family",
  travel: "travel",
  festival: "festival",
  daily: "daily"
};

// TTS 配置
const TTS_CONFIG = {
  enabled: true,
  urlTemplate: "https://tts.baidu.com/text2audio?lan=zh&ie=UTF-8&spd=4&text="
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
   * 从云端加载记忆数据
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

  // 语音播放
  playStory() {
    const text = this.data.currentMemory.story;
    if (!text) {
      wx.showToast({
        title: "暂无故事内容",
        icon: "none"
      });
      return;
    }

    const ttsUrl = `${TTS_CONFIG.urlTemplate}${encodeURIComponent(text)}`;

    const audio = wx.createInnerAudioContext();
    audio.src = ttsUrl;
    audio.play();

    audio.onError((err) => {
      console.error("TTS 播放失败:", err);
      wx.showToast({
        title: "播放失败",
        icon: "none"
      });
    });
  },

  // 打开筛选
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
   * 按年代筛选
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
   * 按类型筛选
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
