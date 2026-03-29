const { loginAPI } = require("../../api/user");

Page({
  data: {
    inviteElderId: "",
    inviteSource: ""
  },

  onLoad(options = {}) {
    this.setData({
      inviteElderId: options.inviteElderId || "",
      inviteSource: options.inviteElderId ? "share" : ""
    });
  },

  async doLogin(role) {
    try {
      wx.showLoading({ title: "登录中" });
      const res = await loginAPI(role);

      wx.setStorageSync("role", role);
      wx.setStorageSync("token", res.token);
      wx.setStorageSync("userId", res.userId);

      wx.hideLoading();

      if (role === "family" && this.data.inviteElderId) {
        wx.redirectTo({
          url: `/pages/family/bind?elderId=${this.data.inviteElderId}&source=${this.data.inviteSource || "share"}`
        });
        return;
      }

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
