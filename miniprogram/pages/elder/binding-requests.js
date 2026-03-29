const {
  getBindingRequestsAPI,
  approveBindingRequestAPI,
  rejectBindingRequestAPI
} = require("../../api/user");

Page({
  data: {
    loading: false,
    requests: []
  },

  onLoad() {
    this.loadRequests();
  },

  onShow() {
    this.loadRequests();
  },

  async loadRequests() {
    this.setData({ loading: true });
    try {
      const requests = await getBindingRequestsAPI();
      this.setData({
        requests: Array.isArray(requests) ? requests : [],
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({
        title: (error && (error.message || error.msg)) || "加载失败",
        icon: "none"
      });
    }
  },

  async approveRequest(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    try {
      wx.showLoading({ title: "处理中" });
      await approveBindingRequestAPI(id);
      wx.hideLoading();
      wx.showToast({ title: "已同意", icon: "success" });
      await this.loadRequests();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: (error && (error.message || error.msg)) || "操作失败",
        icon: "none"
      });
    }
  },

  async rejectRequest(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    try {
      wx.showLoading({ title: "处理中" });
      await rejectBindingRequestAPI(id);
      wx.hideLoading();
      wx.showToast({ title: "已拒绝", icon: "none" });
      await this.loadRequests();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: (error && (error.message || error.msg)) || "操作失败",
        icon: "none"
      });
    }
  }
});
