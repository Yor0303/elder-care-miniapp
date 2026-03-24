// pages/family/members.js
const { getPersonListAPI } = require("../../api/user");

Page({

  data: {
    loading: false,
    members: []
  },

  onLoad() {
    this.loadMembers();
  },

  onShow() {
    this.loadMembers();
  },

  async loadMembers() {
    this.setData({ loading: true });

    try {
      const members = await getPersonListAPI();

      this.setData({
        members,
        loading: false
      });

    } catch (error) {
      console.error("加载成员失败:", error);
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  async onPullDownRefresh() {
    await this.loadMembers();
    wx.stopPullDownRefresh();
  },

  /**
   * 编辑成员
   */
  editMember(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/family/member-edit?id=${id}`
    });
  },

  /**
   * 添加新成员
   */
  addMember() {
    wx.navigateTo({
      url: '/pages/family/member-edit'
    });
  }
});
