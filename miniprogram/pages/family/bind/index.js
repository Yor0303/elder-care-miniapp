const {
  getElderBindInfoAPI,
  findElderByPhoneAPI,
  createBindingRequestAPI,
  getMyBindingRequestsAPI,
  getElderInfoAPI,
  importDemoDataAPI,
  bindCurrentUserToDemoElderAPI
} = require("../../../api/user");

const RELATION_OPTIONS = ["配偶", "子女", "孙辈", "兄弟姐妹", "亲属", "朋友", "护工", "其他"];

function getStatusClass(status) {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    default:
      return "pending";
  }
}

function scanCode() {
  return new Promise((resolve, reject) => {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ["qrCode"],
      success: resolve,
      fail: reject
    });
  });
}

Page({
  data: {
    mode: "scan",
    loading: false,
    demoLoading: false,
    phone: "",
    sharedElder: null,
    requestSent: false,
    pendingRequests: [],
    currentBoundElder: null,
    requestSource: "",
    relationOptions: RELATION_OPTIONS,
    relationIndex: -1,
    relation: ""
  },

  onLoad(options = {}) {
    const elderId = options.elderId || "";
    const source = options.source || "share";
    if (elderId) {
      this.setData({ mode: "invite", requestSource: source });
      this.loadSharedElder(elderId, source);
    }
  },

  onShow() {
    this.loadCurrentBinding();
    this.loadPendingRequests();
  },

  setMode(e) {
    const { mode } = e.currentTarget.dataset;
    if (!mode || mode === this.data.mode) return;
    this.setData({
      mode,
      loading: false
    });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onRelationChange(e) {
    const index = Number(e.detail.value);
    const relation = this.data.relationOptions[index] || "";
    this.setData({
      relationIndex: index,
      relation
    });
  },

  async loadCurrentBinding() {
    try {
      const elder = await getElderInfoAPI();
      if (elder && elder.id) {
        wx.setStorageSync("elderId", elder.id);
      }
      this.setData({
        currentBoundElder: elder && elder.id ? elder : null
      });
    } catch (_) {
      wx.removeStorageSync("elderId");
      this.setData({ currentBoundElder: null });
    }
  },

  async loadPendingRequests() {
    try {
      const requests = await getMyBindingRequestsAPI();
      const pendingRequests = Array.isArray(requests)
        ? requests.map((item) => ({
            ...item,
            statusClass: getStatusClass(item.status)
          }))
        : [];
      this.setData({ pendingRequests });
    } catch (error) {
      console.error("load pending binding requests failed", error);
    }
  },

  async loadSharedElder(elderId, source = "invite") {
    this.setData({
      loading: true,
      requestSent: false
    });
    try {
      const elder = await getElderBindInfoAPI(elderId);
      this.setData({
        sharedElder: elder || null,
        requestSource: source,
        loading: false
      });
    } catch (_) {
      this.setData({
        loading: false,
        sharedElder: null
      });
      wx.showToast({ title: "未找到老人信息", icon: "none" });
    }
  },

  async lookupByPhone() {
    const phone = this.data.phone.trim();
    if (!phone) {
      wx.showToast({ title: "请先输入手机号", icon: "none" });
      return;
    }

    this.setData({
      loading: true,
      requestSent: false
    });

    try {
      const elder = await findElderByPhoneAPI(phone);
      this.setData({
        sharedElder: elder || null,
        requestSource: "phone",
        loading: false
      });
      if (!elder) {
        wx.showToast({ title: "未找到老人信息", icon: "none" });
      }
    } catch (error) {
      this.setData({
        loading: false,
        sharedElder: null
      });
      wx.showToast({
        title: (error && (error.message || error.msg)) || "查找失败",
        icon: "none"
      });
    }
  },

  parseScannedElderId(rawValue = "") {
    const value = String(rawValue || "").trim();
    if (!value) return "";

    try {
      const parsed = JSON.parse(value);
      if (parsed && (parsed.inviteElderId || parsed.elderId)) {
        return parsed.inviteElderId || parsed.elderId;
      }
    } catch (_) {
      // ignore
    }

    const sceneMatch = value.match(/[?&]scene=([^&#]+)/);
    if (sceneMatch && sceneMatch[1]) {
      const decodedScene = decodeURIComponent(sceneMatch[1]);
      const innerMatch = decodedScene.match(/(?:^|&)(?:inviteElderId|elderId)=([^&]+)/);
      if (innerMatch && innerMatch[1]) {
        return innerMatch[1];
      }
    }

    const queryMatch = value.match(/[?&](?:inviteElderId|elderId)=([^&#]+)/);
    if (queryMatch && queryMatch[1]) {
      return decodeURIComponent(queryMatch[1]);
    }

    const directMatch = value.match(/(elder[_-][A-Za-z0-9_-]+)/);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }

    return "";
  },

  async scanBindCode() {
    try {
      const res = await scanCode();
      const elderId = this.parseScannedElderId((res && (res.path || res.result)) || "");
      if (!elderId) {
        wx.showToast({
          title: "未识别到有效二维码",
          icon: "none"
        });
        return;
      }

      this.setData({ mode: "scan" });
      await this.loadSharedElder(elderId, "scan");
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes("cancel")) {
        return;
      }
      wx.showToast({
        title: "扫码失败，请重试",
        icon: "none"
      });
    }
  },

  async enterDemoMode() {
    if (this.data.demoLoading) return;

    try {
      this.setData({ demoLoading: true });
      wx.showLoading({ title: "准备演示中" });
      await importDemoDataAPI();
      const result = await bindCurrentUserToDemoElderAPI();
      const elderId = result && result.elderId;
      if (elderId) {
        wx.setStorageSync("elderId", elderId);
      }
      wx.hideLoading();
      this.setData({ demoLoading: false });
      wx.showToast({ title: "已进入演示数据", icon: "success" });
      this.enterFamilyHome();
    } catch (error) {
      wx.hideLoading();
      this.setData({ demoLoading: false });
      wx.showToast({
        title: (error && (error.message || error.msg)) || "进入演示失败",
        icon: "none"
      });
    }
  },

  async submitInviteRequest() {
    const elder = this.data.sharedElder;
    if (!elder || !elder.id) return;
    if (!this.data.relation) {
      wx.showToast({ title: "请选择关系", icon: "none" });
      return;
    }

    try {
      wx.showLoading({ title: "提交中" });
      const result = await createBindingRequestAPI({
        elderId: elder.id,
        relation: this.data.relation,
        source: this.data.requestSource || this.data.mode
      });
      wx.hideLoading();

      if (result && result.alreadyBound) {
        wx.setStorageSync("elderId", elder.id);
        this.setData({
          currentBoundElder: elder,
          requestSent: false
        });
        wx.showToast({ title: "你已经绑定这位老人", icon: "none" });
        return;
      }

      this.setData({
        requestSent: true
      });

      if (result && result.alreadyPending) {
        wx.showToast({ title: "你已经提交过申请", icon: "none" });
      } else {
        wx.showToast({ title: "申请已提交", icon: "success" });
      }

      await this.loadPendingRequests();
      await this.loadCurrentBinding();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: (error && (error.message || error.msg)) || "提交失败",
        icon: "none"
      });
    }
  },

  enterFamilyHome() {
    wx.switchTab({
      url: "/pages/family/home",
      fail: () => {
        wx.reLaunch({ url: "/pages/family/home" });
      }
    });
  }
});
