const { getElderInfoAPI, getMemoriesAPI } = require("../../api/user");

Page({
  data: {
    loading: true,
    elder: null,
    selfMemories: []
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });

    try {
      const elder = await getElderInfoAPI();
      const memoriesRaw = await getMemoriesAPI({});
      const memories = Array.isArray(memoriesRaw)
        ? memoriesRaw
        : (memoriesRaw && Array.isArray(memoriesRaw.data) ? memoriesRaw.data : []);

      const name = elder && elder.name ? elder.name.trim() : "";
      const selfKeys = ["本人", "自己", "我"];
      const selfMemories = (memories || [])
        .filter((m) => {
          const person = (m.person || "").trim();
          if (!person) return false;
          if (selfKeys.includes(person)) return true;
          if (name && person === name) return true;
          return false;
        })
        .sort((a, b) => (a.year || 0) - (b.year || 0));

      this.setData({
        elder,
        selfMemories,
        loading: false
      });
    } catch (error) {
      console.error("load elder profile failed", error);
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  }
});
