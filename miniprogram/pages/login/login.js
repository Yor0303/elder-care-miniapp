const { loginAPI } = require("../../api/user");

Page({
  async doLogin(role) {
    try {
      wx.showLoading({ title: "登录中" });
      const res = await loginAPI();

      wx.setStorageSync("role", role);
      wx.setStorageSync("token", res.token);
      wx.setStorageSync("userId", res.userId);

      wx.hideLoading();
      wx.redirectTo({
        url: role === "elder" ? "/pages/elder/home" : "/pages/family/home"
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: "登录失败",
        icon: "none"
      });
      console.error("login failed", error);
    }
  },

  enterElder() {
    this.doLogin("elder");
  },

  enterFamily() {
    this.doLogin("family");
  }
});
