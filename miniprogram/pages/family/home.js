// pages/family/home.js
const { getElderInfoAPI } = require("../../api/user");

Page({
  data: {
    elderName: "老人"
  },

  onLoad() {
    this.loadElderName();
  },

  async loadElderName() {
    try {
      const elder = await getElderInfoAPI();
      const name = elder && elder.name ? elder.name.trim() : "";
      if (name) {
        this.setData({ elderName: name });
      }
    } catch (error) {
      // ignore
    }
  },

  goToMemoryManage() {
    wx.navigateTo({
      url: "/pages/memories/index"
    });
  },

  goToMembers() {
    wx.navigateTo({
      url: "/pages/family/members"
    });
  },

  goToHealthManage() {
    wx.navigateTo({
      url: "/pages/family/health-manage"
    });
  },

  goToProfile() {
    wx.navigateTo({
      url: "/pages/family/profile"
    });
  }
});
