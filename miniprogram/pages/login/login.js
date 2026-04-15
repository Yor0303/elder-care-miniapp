const { loginAPI, registerAPI } = require("../../api/user");

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

function shouldUseModalForError(message = "") {
  const text = String(message || "").trim();
  if (!text) return false;
  return text.includes("当前微信号已注册为") || text.length > 10;
}

function buildPreviewHomeUrl(role) {
  const targetRole = role === "family" ? "family" : "elder";
  return targetRole === "family"
    ? "/pages/family/home?guest=1&from=login"
    : "/pages/elder/home?guest=1&from=login";
}

function normalizeNickname(value) {
  return String(value || "").trim();
}

function relaunchWithFallback(url) {
  return new Promise((resolve, reject) => {
    wx.reLaunch({
      url,
      success: resolve,
      fail: (relaunchError) => {
        console.error("reLaunch failed:", url, relaunchError);
        wx.redirectTo({
          url,
          success: resolve,
          fail: (redirectError) => {
            console.error("redirectTo failed:", url, redirectError);
            reject(redirectError || relaunchError);
          }
        });
      }
    });
  });
}

Page({
  data: {
    showBack: false,
    selectedRole: "elder",
    existingAccountRole: "",
    existingAccountChecked: false,
    inviteElderId: "",
    inviteSource: "",
    loading: false,
    agreed: false,
    authMode: false,
    nickname: "",
    avatar: "",
    avatarTempFilePath: "",
    copy: {
      brand: "\u6613\u5fc6\u7ad9",
      welcomeTitle: "\u6b22\u8fce\u4f7f\u7528\u6613\u5fc6\u7ad9",
      subtitleInvite: "\u5df2\u6839\u636e\u9080\u8bf7\u9ed8\u8ba4\u9009\u4e2d\u5bb6\u5c5e\u8eab\u4efd",
      subtitleDefault: "\u9009\u62e9\u8eab\u4efd\u540e\uff0c\u53ef\u5148\u8fdb\u5165\u5bf9\u5e94\u9996\u9875\u9884\u89c8\uff0c\u4f7f\u7528\u5177\u4f53\u529f\u80fd\u65f6\u518d\u81ea\u884c\u767b\u5f55\u6ce8\u518c",
      roleTitle: "\u9009\u62e9\u8eab\u4efd",
      roleInviteTip: "\u53ef\u5de6\u53f3\u5207\u6362",
      roleElder: "\u8001\u4eba",
      roleFamily: "\u5bb6\u5c5e",
      roleElderDesc: "\u8bb0\u5f55\u751f\u6d3b\u70b9\u6ef4\u4e0e\u5065\u5eb7\u4fe1\u606f",
      roleFamilyDesc: "\u966a\u4f34\u5bb6\u4eba\uff0c\u8fdc\u7a0b\u5173\u6000\u4e0e\u534f\u52a9",
      previewPrimary: "\u8fdb\u5165\u9996\u9875\u9884\u89c8",
      previewHelper: "\u53ef\u5148\u6d4f\u89c8\u9996\u9875\u5e03\u5c40\u4e0e\u529f\u80fd\u5165\u53e3\uff0c\u4f7f\u7528\u5177\u4f53\u529f\u80fd\u65f6\u518d\u767b\u5f55/\u6ce8\u518c\u3002",
      authHelper: "\u8bf7\u81ea\u4e3b\u9009\u62e9\u5934\u50cf\u548c\u6635\u79f0\u540e\uff0c\u518d\u7ee7\u7eed\u4f7f\u7528\u5b8c\u6574\u670d\u52a1\u3002",
      authPanelTitle: "\u767b\u5f55/\u6ce8\u518c",
      authPanelDesc: "\u6d4f\u89c8\u9996\u9875\u540e\uff0c\u5982\u9700\u4f7f\u7528\u5177\u4f53\u529f\u80fd\uff0c\u8bf7\u5728\u6b64\u81ea\u4e3b\u5b8c\u6210\u767b\u5f55/\u6ce8\u518c\u3002",
      authExistingDesc: "\u68c0\u6d4b\u5230\u5f53\u524d\u5fae\u4fe1\u53f7\u5df2\u6ce8\u518c\uff0c\u53ef\u76f4\u63a5\u767b\u5f55\u8fdb\u5165\u3002",
      authConflictDesc: "\u5f53\u524d\u8d26\u53f7\u5df2\u7ed1\u5b9a\uff0c\u8bf7\u5207\u6362\u5230\u5df2\u6ce8\u518c\u8eab\u4efd\u767b\u5f55\u3002",
      avatarLabel: "\u5934\u50cf\u6388\u6743",
      avatarAction: "\u70b9\u51fb\u9009\u62e9\u5934\u50cf",
      nicknameLabel: "\u6635\u79f0\u6388\u6743",
      nicknamePlaceholder: "\u8bf7\u8f93\u5165\u6216\u4f7f\u7528\u5fae\u4fe1\u6635\u79f0",
      authPrimary: "\u5b8c\u6210\u8d44\u6599\u5e76\u767b\u5f55/\u6ce8\u518c",
      authPrimaryLogin: "\u76f4\u63a5\u767b\u5f55",
      authPrimarySwitch: "\u5207\u6362\u5df2\u6ce8\u518c\u8eab\u4efd",
      switchToAuth: "\u767b\u5f55/\u6ce8\u518c",
      switchToPreview: "\u5148\u770b\u770b\u9996\u9875",
      agreementPrefix: "\u5df2\u9605\u8bfb\u5e76\u540c\u610f",
      agreementUser: "\u300a\u6613\u5fc6\u7ad9\u7528\u6237\u534f\u8bae\u300b",
      agreementJoiner: "\u548c",
      agreementPrivacy: "\u300a\u9690\u79c1\u653f\u7b56\u300b",
      footerService: "\u670d\u52a1\u70ed\u7ebf",
      footerHelp: "\u5e2e\u52a9\u4e2d\u5fc3",
      footerAbout: "\u5e73\u53f0\u8bf4\u660e",
      toastAgreement: "\u8bf7\u5148\u9605\u8bfb\u5e76\u540c\u610f\u534f\u8bae",
      toastNickname: "\u8bf7\u5148\u586b\u5199\u6635\u79f0",
      toastAvatar: "\u8bf7\u5148\u9009\u62e9\u5934\u50cf",
      toastUserAgreement: "\u7528\u6237\u534f\u8bae\u5f85\u8865\u5145",
      toastPrivacy: "\u9690\u79c1\u653f\u7b56\u5f85\u8865\u5145",
      loadingAvatar: "\u4e0a\u4f20\u5934\u50cf\u4e2d",
      loadingLogin: "\u767b\u5f55\u4e2d",
      failLogin: "\u767b\u5f55\u5931\u8d25"
    }
  },

  onLoad(options = {}) {
    const inviteInfo = parseInviteElderId(options);
    const selectedRole = options.role === "family" || options.role === "elder"
      ? options.role
      : inviteInfo.inviteElderId
        ? "family"
        : "elder";

    this.setData({
      showBack: getCurrentPages().length > 1,
      ...inviteInfo,
      selectedRole,
      authMode: String(options.auth || "") === "1"
    });

    this.checkExistingAccount();
  },

  selectRole(event) {
    const { role } = event.currentTarget.dataset;
    if (!role || role === this.data.selectedRole) {
      return;
    }

    this.setData({ selectedRole: role });
  },

  async checkExistingAccount() {
    try {
      const result = await loginAPI();
      this.setData({
        existingAccountRole: (result && result.userType) || "",
        existingAccountChecked: true
      });
    } catch (error) {
      const message = getErrorMessage(error, "");
      if (message.includes("未注册")) {
        this.setData({
          existingAccountRole: "",
          existingAccountChecked: true
        });
        return;
      }

      this.setData({ existingAccountChecked: true });
    }
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
      return;
    }

    if (this.data.authMode) {
      this.setData({ authMode: false });
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

  enterAuthMode() {
    this.setData({ authMode: true });
  },

  handleNicknameInput(event) {
    this.setData({
      nickname: normalizeNickname(event.detail.value)
    });
  },

  handleChooseAvatar(event) {
    const avatarUrl = (event && event.detail && event.detail.avatarUrl) || "";
    if (!avatarUrl) {
      return;
    }

    this.setData({
      avatar: avatarUrl,
      avatarTempFilePath: avatarUrl
    });
  },

  goToPreviewHome() {
    wx.reLaunch({
      url: buildPreviewHomeUrl(this.data.selectedRole)
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

  async navigateAfterLogin(loginResult) {
    const role = loginResult.userType || "elder";
    let targetUrl = "";

    if (role === "family" && this.data.inviteElderId) {
      targetUrl = `/pages/family/bind/index?elderId=${this.data.inviteElderId}&source=${this.data.inviteSource || "share"}`;
      await relaunchWithFallback(targetUrl);
      return;
    }

    if (role === "family" && !loginResult.boundElderId) {
      targetUrl = "/pages/family/bind/index";
      await relaunchWithFallback(targetUrl);
      return;
    }

    targetUrl = role === "elder" ? "/pages/elder/home" : "/pages/family/home";
    await relaunchWithFallback(targetUrl);
  },

  uploadAvatarToCloud(tempFilePath, folder = "user-avatars") {
    return new Promise((resolve, reject) => {
      const extMatch = String(tempFilePath || "").match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : ".png";
      const cloudPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 11)}${ext}`;
      let settled = false;
      const finish = (handler, payload) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        handler(payload);
      };
      const timeoutId = setTimeout(() => {
        finish(reject, new Error("头像上传超时，请检查云环境或稍后重试"));
      }, 15000);

      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => {
          const fileID = res && res.fileID;
          if (!fileID) {
            finish(reject, new Error("头像上传失败，请重新选择头像"));
            return;
          }
          finish(resolve, fileID);
        },
        fail: (error) => {
          finish(reject, error);
        }
      });
    });
  },

  validateAuthForm() {
    if (!this.ensureAgreement()) {
      return false;
    }

    if (!normalizeNickname(this.data.nickname)) {
      wx.showToast({
        title: this.data.copy.toastNickname,
        icon: "none"
      });
      return false;
    }

    if (!this.data.avatar) {
      wx.showToast({
        title: this.data.copy.toastAvatar,
        icon: "none"
      });
      return false;
    }

    return true;
  },

  async handleManualRegister() {
    if (this.data.loading) {
      return;
    }

    if (!this.ensureAgreement()) {
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: this.data.copy.loadingLogin });

    try {
      let existingLogin = null;
      try {
        existingLogin = await loginAPI();
      } catch (loginError) {
        const loginMessage = getErrorMessage(loginError, "");
        if (!loginMessage.includes("未注册")) {
          throw loginError;
        }
      }

      if (existingLogin) {
        this.setData({
          existingAccountRole: existingLogin.userType || "",
          existingAccountChecked: true
        });
        if ((existingLogin.userType || "elder") !== this.data.selectedRole) {
          const registeredRoleText = existingLogin.userType === "family" ? "家属" : "老人";
          wx.showModal({
            title: "提示",
            content: `当前微信号已注册为${registeredRoleText}`,
            showCancel: false
          });
          return;
        }

        this.saveSession(existingLogin);
        await this.navigateAfterLogin(existingLogin);
        return;
      }

      if (!this.validateAuthForm()) {
        return;
      }

      const nickname = normalizeNickname(this.data.nickname);
      let avatar = this.data.avatar;

      if (this.data.avatarTempFilePath && this.data.avatarTempFilePath.startsWith("wxfile://")) {
        wx.showLoading({ title: this.data.copy.loadingAvatar });
        avatar = await this.uploadAvatarToCloud(this.data.avatarTempFilePath);
        wx.showLoading({ title: this.data.copy.loadingLogin });
        this.setData({
          avatar,
          avatarTempFilePath: ""
        });
      }

      const res = await registerAPI(
        this.data.selectedRole,
        nickname,
        avatar
      );
      this.setData({
        existingAccountRole: res.userType || this.data.selectedRole,
        existingAccountChecked: true
      });
      this.saveSession(res);
      await this.navigateAfterLogin(res);
    } catch (error) {
      const errorMessage = getErrorMessage(error, this.data.copy.failLogin);
      if (shouldUseModalForError(errorMessage)) {
        wx.showModal({
          title: "提示",
          content: errorMessage,
          showCancel: false
        });
      } else {
        wx.showToast({
          title: errorMessage,
          icon: "none"
        });
      }
      console.error("manual register failed", error);
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  handlePrimaryAction() {
    this.goToPreviewHome();
  },

  handleSecondaryAction() {
    if (this.data.authMode) {
      this.setData({ authMode: false });
      return;
    }

    this.enterAuthMode();
  }
});
