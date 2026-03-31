const {
  getBindingRequestsAPI,
  approveBindingRequestAPI,
  rejectBindingRequestAPI
} = require("../../api/user");

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

Page({
  data: {
    loading: false,
    requests: [],
    pendingRequests: [],
    approvedRequests: [],
    historyRequests: []
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
      const list = Array.isArray(requests)
        ? requests.map((item) => ({
            ...item,
            applicantName: item.applicantName || item.name || "家属",
            requestTime: item.requestTime ? formatDateTime(item.requestTime) : formatDateTime(item.createdAt),
            statusText:
              item.status === "approved" ? "已绑定" : item.status === "rejected" ? "已拒绝" : "待处理"
          }))
        : [];

      this.setData({
        requests: list,
        pendingRequests: list.filter((item) => item.status === "pending"),
        approvedRequests: list.filter((item) => item.status === "approved"),
        historyRequests: list.filter((item) => item.status !== "pending" && item.status !== "approved"),
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
      wx.showToast({ title: "已同意绑定", icon: "success" });
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
      wx.showToast({ title: "已拒绝申请", icon: "none" });
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
