const { getPersonListAPI } = require("../../api/user");

Page({
  data: {
    familyList: []
  },

  async onLoad() {
    try {
      wx.showLoading({ title: "加载中" });
      const familyList = await getPersonListAPI();
      this.setData({ familyList });
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: "加载失败",
        icon: "none"
      });
      console.error("load family list failed", error);
    }
  },

  goToProfile(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/elder/profile?personId=${id}`
    });
  }
});
