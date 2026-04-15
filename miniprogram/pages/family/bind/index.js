const {
  getElderBindInfoAPI,
  findElderByPhoneAPI,
  createBindingRequestAPI,
  getMyBindingRequestsAPI,
  getElderInfoAPI,
  importDemoDataAPI,
  bindCurrentUserToDemoElderAPI
} = require("../../../api/user");
const {
  getPreviewBindingState,
  isPreviewMode,
  promptPreviewLogin
} = require("../../../utils/family-preview");

const RELATION_OPTIONS = ["配偶", "子女", "孙辈", "兄弟姐妹", "亲属", "朋友", "护工", "其他"];

function buildRelationActionItems() {
  return RELATION_OPTIONS.map((item) => ({
    text: item,
    value: item
  }));
}

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
      success: resolve,
      fail: reject
    });
  });
}

Page({
  data: {
    previewMode: false,
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
    relation: "",
    showRelationSheet: false,
    relationActionItems: buildRelationActionItems()
  },

  onLoad(options = {}) {
    const previewMode = isPreviewMode(options);
    this.setData({ previewMode });

    if (previewMode) {
      const previewState = getPreviewBindingState();
      this.setData({
        currentBoundElder: previewState.currentBoundElder,
        sharedElder: previewState.sharedElder,
        pendingRequests: previewState.pendingRequests,
        relation: previewState.relation,
        relationIndex: previewState.relationIndex,
        requestSource: "phone"
      });
      return;
    }

    const elderId = options.elderId || "";
    const source = options.source || "share";
    if (elderId) {
      this.setData({ mode: "invite", requestSource: source });
      this.loadSharedElder(elderId, source);
    }
  },

  onShow() {
    if (this.data.previewMode) {
      return;
    }
    this.loadCurrentBinding();
    this.loadPendingRequests();
  },

  setMode(e) {
    if (this.data.previewMode) {
      this.setData({
        mode: e.currentTarget.dataset.mode || "scan"
      });
      return;
    }
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

  openRelationSheet() {
    this.setData({ showRelationSheet: true });
  },

  closeRelationSheet() {
    this.setData({ showRelationSheet: false });
  },

  onRelationActionTap(e) {
    const relation = (e.detail && e.detail.value) || "";
    const relationIndex = this.data.relationOptions.indexOf(relation);
    this.setData({
      relation,
      relationIndex,
      showRelationSheet: false
    });
  },

  async loadCurrentBinding() {
    if (this.data.previewMode) {
      return;
    }
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
    if (this.data.previewMode) {
      return;
    }
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
    if (this.data.previewMode) {
      return;
    }
    this.setData({
      loading: true,
      sharedElder: null,
      requestSent: false,
      requestSource: source,
      relation: "",
      relationIndex: -1
    });
    try {
      const elder = await getElderBindInfoAPI(elderId);
      this.setData({
        sharedElder: elder || null,
        requestSource: source,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        sharedElder: null
      });
      wx.showToast({
        title: (error && (error.message || error.msg)) || "加载老人信息失败",
        icon: "none"
      });
    }
  },

  async lookupByPhone() {
    if (this.data.previewMode) {
      promptPreviewLogin("查找并绑定老人");
      return;
    }
    const phone = this.data.phone.trim();
    if (!phone) {
      wx.showToast({ title: "请先输入手机号", icon: "none" });
      return;
    }

    this.setData({
      loading: true,
      requestSent: false,
      requestSource: "phone"
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

    const directPairMatch = value.match(/(?:^|[\s?&])(inviteElderId|elderId)=([^&#\s]+)/);
    if (directPairMatch && directPairMatch[2]) {
      return decodeURIComponent(directPairMatch[2]);
    }

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
        return decodeURIComponent(innerMatch[1]);
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

    const pureIdMatch = value.match(/^[A-Za-z0-9_-]{24,32}$/);
    if (pureIdMatch && pureIdMatch[0]) {
      return pureIdMatch[0];
    }

    return "";
  },

  async scanBindCode() {
    if (this.data.previewMode) {
      promptPreviewLogin("扫码绑定");
      return;
    }
    if (this.data.loading) return;
    try {
      const res = await scanCode();
      const elderId = this.parseScannedElderId(
        (res && [res.path, res.result, res.rawData]
          .filter(Boolean)
          .join(" ")) || ""
      );
      if (!elderId) {
        console.error("scan bind code parse failed:", res);
        wx.showToast({
          title: "未识别到带绑定信息的二维码",
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
    if (this.data.previewMode) {
      promptPreviewLogin("进入演示绑定");
      return;
    }
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
    if (this.data.previewMode) {
      promptPreviewLogin("提交绑定申请");
      return;
    }
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
