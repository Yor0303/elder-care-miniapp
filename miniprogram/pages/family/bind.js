const {
  getElderBindInfoAPI,
  createBindingRequestAPI,
  getMyBindingRequestsAPI
} = require("../../api/user");

Page({
  data: {
    mode: "phone",
    loading: false,
    phone: "",
    sharedElder: null,
    requestSent: false,
    pendingRequests: []
  },

  onLoad(options = {}) {
    const elderId = options.elderId || "";
    if (elderId) {
      this.setData({ mode: "invite" });
      this.loadSharedElder(elderId);
    }
  },

  onShow() {
    this.loadPendingRequests();
  },

  setMode(e) {
    const { mode } = e.currentTarget.dataset;
    if (!mode) return;
    this.setData({ mode });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  async loadPendingRequests() {
    try {
      const pendingRequests = await getMyBindingRequestsAPI();
      this.setData({ pendingRequests: Array.isArray(pendingRequests) ? pendingRequests : [] });
    } catch (error) {
      console.error("load pending binding requests failed", error);
    }
  },

  async loadSharedElder(elderId) {
    this.setData({ loading: true, requestSent: false });
    try {
      const elder = await getElderBindInfoAPI(elderId);
      this.setData({
        sharedElder: elder || null,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false, sharedElder: null });
      wx.showToast({ title: "邀请信息已失效", icon: "none" });
    }
  },

  previewPhoneLookup() {
    if (!this.data.phone.trim()) {
      wx.showToast({ title: "请先输入手机号", icon: "none" });
      return;
    }

    wx.showToast({
      title: "手机号查找与审批流程待接入",
      icon: "none"
    });
  },

  previewScanFlow() {
    wx.showToast({
      title: "扫码绑定流程待接入",
      icon: "none"
    });
  },

  async submitInviteRequest() {
    const elder = this.data.sharedElder;
    if (!elder || !elder.id) return;

    try {
      wx.showLoading({ title: "提交中" });
      const result = await createBindingRequestAPI({
        elderId: elder.id
      });
      wx.hideLoading();

      this.setData({
        requestSent: true
      });

      if (result && result.alreadyPending) {
        wx.showToast({ title: "你已提交过申请", icon: "none" });
      } else if (result && result.alreadyBound) {
        wx.showToast({ title: "你已绑定这位老人", icon: "none" });
      } else {
        wx.showToast({ title: "申请已提交", icon: "success" });
      }

      await this.loadPendingRequests();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: (error && (error.message || error.msg)) || "提交失败",
        icon: "none"
      });
    }
  }
});
