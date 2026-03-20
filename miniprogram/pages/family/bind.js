const { getElderListAPI, bindElderAPI } = require("../../api/user");

Page({
  data: {
    elderList: []
  },

  onLoad() {
    this.loadElderList();
  },

  async loadElderList() {
    try {
      const elderList = await getElderListAPI();
      this.setData({ elderList: elderList || [] });
    } catch (error) {
      wx.showToast({ title: "加载老人列表失败", icon: "none" });
    }
  },

  async bindElder(e) {
    const elderId = e.currentTarget.dataset.id;
    if (!elderId) return;

    try {
      wx.showLoading({ title: "绑定�?" });
      await bindElderAPI(elderId);
      wx.setStorageSync("elderId", elderId);
      wx.hideLoading();
      wx.showToast({ title: "绑定成功", icon: "success" });

      setTimeout(() => {
        wx.navigateBack({
          delta: 1,
          fail: () => {
            wx.redirectTo({ url: "/pages/family/home" });
          }
        });
      }, 800);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: (error && (error.message || error.msg)) || "绑定失败",
        icon: "none"
      });
    }
  }
});


