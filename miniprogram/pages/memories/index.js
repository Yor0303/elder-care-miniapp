// pages/memories/index.js
const { getMemoriesAPI } = require("../../api/user");

Page({
  data: {
    list: [],
    loading: true
  },

  onLoad() {
    this.loadMemories();
  },

  onShow() {
    this.loadMemories();
  },

  async onPullDownRefresh() {
    await this.loadMemories();
    wx.stopPullDownRefresh();
  },

  async loadMemories() {
    this.setData({ loading: true });

    try {
      const list = await getMemoriesAPI({});
      const sorted = (list || []).sort((a, b) => (b.year || 0) - (a.year || 0));
      this.setData({ list: sorted, loading: false });
    } catch (error) {
      console.error("加载回忆失败:", error);
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  editMemory(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/family/memory-edit?id=${id}`
    });
  },

  uploadMemory() {
    wx.navigateTo({
      url: "/pages/family/upload"
    });
  }
});
