const { registerAPI, loginAPI } = require("../../api/user");

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
    mode: "register",
    selectedRole: "elder",
    inviteElderId: "",
    inviteSource: "",
    loading: false,
    registeredRoleLabel: ""
  },

  onLoad(options = {}) {
    const inviteInfo = parseInviteElderId(options);
    this.setData({
      ...inviteInfo,
      selectedRole: inviteInfo.inviteElderId ? "family" : "elder"
    });
  },

  switchMode(event) {
    const { mode } = event.currentTarget.dataset;
    if (!mode || mode === this.data.mode) {
      return;
    }

    this.setData({ mode });
  },

  selectRole(event) {
    const { role } = event.currentTarget.dataset;
    if (!role || role === this.data.selectedRole) {
      return;
    }

    this.setData({ selectedRole: role });
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

  async submitRegister() {
    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: "注册中" });

    try {
      const res = await registerAPI(this.data.selectedRole);
      const roleLabel = res.userType === "elder" ? "老人" : "家属";

      wx.hideLoading();
      wx.showToast({
        title: res.alreadyRegistered ? `已注册为${roleLabel}` : "注册成功",
        icon: "none"
      });

      this.setData({
        mode: "login",
        registeredRoleLabel: roleLabel,
        loading: false
      });
    } catch (error) {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({
        title: getErrorMessage(error, "注册失败"),
        icon: "none"
      });
      console.error("register failed", error);
    }
  },

  async submitLogin() {
    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: "登录中" });

    try {
      const res = await loginAPI();
      this.saveSession(res);
      wx.hideLoading();
      this.setData({ loading: false });
      this.navigateAfterLogin(res);
    } catch (error) {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({
        title: getErrorMessage(error, "登录失败"),
        icon: "none"
      });
      console.error("login failed", error);
    }
  }
});
