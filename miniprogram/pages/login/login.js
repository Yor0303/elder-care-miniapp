const { quickLoginWithPhoneAPI } = require("../../api/user");

function parseInviteElderId(options = {}) {
  if (options.inviteElderId) {
    return {
      inviteElderId: options.inviteElderId,
      inviteSource: "share"
    };
  }

  const scene = decodeURIComponent(options.scene || "");
  if (!scene) {
    return {
      inviteElderId: "",
      inviteSource: ""
    };
  }

  const match = scene.match(/(?:^|&)(?:inviteElderId|elderId)=([^&]+)/);
  return {
    inviteElderId: match && match[1] ? match[1] : "",
    inviteSource: match && match[1] ? "qrcode" : ""
  };
}

function getErrorMessage(error, fallback) {
  return (
    (error && (error.message || error.errMsg)) ||
    (error && error.result && error.result.message) ||
    fallback
  );
}

Page({
  data: {
    showBack: false,
    selectedRole: "elder",
    inviteElderId: "",
    inviteSource: "",
    loading: false,
    agreed: false,
    copy: {
      brand: "\u6613\u5fc6\u7ad9",
      welcomeTitle: "\u6b22\u8fce\u4f7f\u7528\u6613\u5fc6\u7ad9",
      subtitleInvite: "\u5df2\u6839\u636e\u9080\u8bf7\u9ed8\u8ba4\u9009\u4e2d\u5bb6\u5c5e\u8eab\u4efd",
      subtitleDefault: "\u9009\u62e9\u8eab\u4efd\u540e\uff0c\u6388\u6743\u5fae\u4fe1\u624b\u673a\u53f7\u5373\u53ef\u5feb\u6377\u767b\u5f55",
      roleTitle: "\u9009\u62e9\u8eab\u4efd",
      roleInviteTip: "\u53ef\u5de6\u53f3\u5207\u6362",
      roleElder: "\u8001\u4eba",
      roleFamily: "\u5bb6\u5c5e",
      roleElderDesc: "\u8bb0\u5f55\u751f\u6d3b\u70b9\u6ef4\u4e0e\u5065\u5eb7\u4fe1\u606f",
      roleFamilyDesc: "\u966a\u4f34\u5bb6\u4eba\uff0c\u8fdc\u7a0b\u5173\u6000\u4e0e\u534f\u52a9",
      loginPrimary: "\u624b\u673a\u53f7\u5feb\u6377\u767b\u5f55",
      helperLogin: "\u9996\u6b21\u6388\u6743\u5c06\u81ea\u52a8\u5b8c\u6210\u6ce8\u518c\uff0c\u5e76\u540c\u6b65\u5fae\u4fe1\u624b\u673a\u53f7",
      agreementPrefix: "\u5df2\u9605\u8bfb\u5e76\u540c\u610f",
      agreementUser: "\u300a\u6613\u5fc6\u7ad9\u7528\u6237\u534f\u8bae\u300b",
      agreementJoiner: "\u548c",
      agreementPrivacy: "\u300a\u9690\u79c1\u653f\u7b56\u300b",
      footerService: "\u670d\u52a1\u70ed\u7ebf",
      footerHelp: "\u5e2e\u52a9\u4e2d\u5fc3",
      footerAbout: "\u5e73\u53f0\u8bf4\u660e",
      toastAgreement: "\u8bf7\u5148\u9605\u8bfb\u5e76\u540c\u610f\u534f\u8bae",
      toastPhoneAuthDenied: "\u9700\u8981\u6388\u6743\u624b\u673a\u53f7\u540e\u624d\u80fd\u767b\u5f55",
      toastPhoneAuthFailed: "\u672a\u83b7\u53d6\u5230\u624b\u673a\u53f7\u6388\u6743\u51ed\u8bc1",
      toastUserAgreement: "\u7528\u6237\u534f\u8bae\u5f85\u8865\u5145",
      toastPrivacy: "\u9690\u79c1\u653f\u7b56\u5f85\u8865\u5145",
      loadingLogin: "\u767b\u5f55\u4e2d",
      failLogin: "\u767b\u5f55\u5931\u8d25"
    }
  },

  onLoad(options = {}) {
    const inviteInfo = parseInviteElderId(options);
    this.setData({
      showBack: getCurrentPages().length > 1,
      ...inviteInfo,
      selectedRole: inviteInfo.inviteElderId ? "family" : "elder"
    });
  },

  selectRole(event) {
    const { role } = event.currentTarget.dataset;
    if (!role || role === this.data.selectedRole) {
      return;
    }

    this.setData({ selectedRole: role });
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  ensureAgreement() {
    if (this.data.agreed) {
      return true;
    }

    wx.showToast({
      title: this.data.copy.toastAgreement,
      icon: "none"
    });
    return false;
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
    }
  },

  openAgreement() {
    wx.showToast({
      title: this.data.copy.toastUserAgreement,
      icon: "none"
    });
  },

  openPrivacy() {
    wx.showToast({
      title: this.data.copy.toastPrivacy,
      icon: "none"
    });
  },

  saveSession(loginResult) {
    const role = loginResult.userType || "elder";
    wx.setStorageSync("role", role);
    wx.setStorageSync("token", loginResult.token);
    wx.setStorageSync("userId", loginResult.userId);

    if (role === "family" && loginResult.boundElderId) {
      wx.setStorageSync("elderId", loginResult.boundElderId);
    } else {
      wx.removeStorageSync("elderId");
    }
  },

  navigateAfterLogin(loginResult) {
    const role = loginResult.userType || "elder";

    if (role === "family" && this.data.inviteElderId) {
      wx.reLaunch({
        url: `/pages/family/bind/index?elderId=${this.data.inviteElderId}&source=${this.data.inviteSource || "share"}`
      });
      return;
    }

    if (role === "family" && !loginResult.boundElderId) {
      wx.reLaunch({
        url: "/pages/family/bind/index"
      });
      return;
    }

    wx.reLaunch({
      url: role === "elder" ? "/pages/elder/home" : "/pages/family/home"
    });
  },

  async handlePrimaryAction(event) {
    if (this.data.loading) {
      return;
    }

    if (!this.ensureAgreement()) {
      return;
    }

    const detail = (event && event.detail) || {};
    const phoneCode = detail.code || "";
    const cloudID = detail.cloudID || "";

    if (!phoneCode && !cloudID) {
      wx.showToast({
        title:
          detail.errMsg && (detail.errMsg.includes("deny") || detail.errMsg.includes("cancel"))
            ? this.data.copy.toastPhoneAuthDenied
            : this.data.copy.toastPhoneAuthFailed,
        icon: "none"
      });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: this.data.copy.loadingLogin });

    try {
      const res = await quickLoginWithPhoneAPI(this.data.selectedRole, phoneCode, cloudID);
      this.saveSession(res);
      wx.hideLoading();
      this.setData({ loading: false });
      this.navigateAfterLogin(res);
    } catch (error) {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({
        title: getErrorMessage(error, this.data.copy.failLogin),
        icon: "none"
      });
      console.error("login flow failed", error);
    }
  }
});
