const { getPersonDetailAPI } = require("../../api/user");

Page({
  data: {
    person: null
  },

  async onLoad(options) {
    try {
      wx.showLoading({ title: "加载中" });
      const person = await getPersonDetailAPI(options.personId);
      this.setData({ person });
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: "加载失败",
        icon: "none"
      });
      console.error("load person detail failed", error);
    }
  }
});
