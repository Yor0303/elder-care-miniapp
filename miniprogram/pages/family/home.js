const { getElderInfoAPI } = require("../../api/user");

Page({
  data: {
    elderName: "未绑定老人",
    hasBoundElder: false
  },

  onLoad() {
    this.loadElderName();
  },

  onShow() {
    this.loadElderName();
  },

  async loadElderName() {
    try {
      const elder = await getElderInfoAPI();
      const name = elder && elder.name ? elder.name.trim() : "";
      if (elder && elder.id) {
        wx.setStorageSync("elderId", elder.id);
      }
      if (name) {
        this.setData({ elderName: name, hasBoundElder: true });
        return;
      }
      this.setData({ elderName: "已绑定老人", hasBoundElder: true });
    } catch (_) {
      wx.removeStorageSync("elderId");
      this.setData({ elderName: "未绑定老人", hasBoundElder: false });
    }
  },

  ensureBoundElder() {
    if (this.data.hasBoundElder) {
      return true;
    }
    wx.showModal({
      title: "请先绑定老人",
      content: "绑定成功后，才能继续管理老人资料、回忆和健康信息。",
      confirmText: "去绑定",
      success: (res) => {
        if (res.confirm) {
          this.goToBindPage();
        }
      }
    });
    return false;
  },

  goToMemoryManage() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/memories/index"
    });
  },

  goToMembers() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/members"
    });
  },

  goToHealthManage() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/health-manage"
    });
  },

  goToMessageBoard() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/message-board"
    });
  },

  goToLifeGuides() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/life-guides"
    });
  },

  goToProfile() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/profile"
    });
  },

  goToBindPage() {
    wx.navigateTo({
      url: "/pages/family/bind/index",
      fail: (err) => {
        console.error("navigate to bind page failed:", err);
      }
    });
  }
});
