// pages/family/home.js
Page({

  data: {
    elderName: "老人"
  },

  onLoad() {
    // 可以从云端获取老人信息
  },

  goToUpload() {
    wx.navigateTo({
      url: '/pages/family/upload'
    });
  },

  goToMembers() {
    wx.navigateTo({
      url: '/pages/family/members'
    });
  },

  goToHealthManage() {
    wx.navigateTo({
      url: '/pages/family/health-manage'
    });
  }
});
