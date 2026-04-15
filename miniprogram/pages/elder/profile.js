const { getElderInfoAPI, getMemoriesAPI, updateElderInfoAPI } = require("../../api/user");
const {
  isPreviewMode,
  previewElderProfile,
  previewMemories
} = require("../../utils/elder-preview");

function isCloudFileId(value) {
  return typeof value === "string" && value.startsWith("cloud://");
}

function resolveTempFileURL(fileID) {
  if (!isCloudFileId(fileID)) {
    return Promise.resolve(fileID || "");
  }

  return wx.cloud
    .getTempFileURL({ fileList: [fileID] })
    .then((res) => {
      const item = res && res.fileList && res.fileList[0];
      return (item && (item.tempFileURL || item.tempFileUrl)) || fileID;
    })
    .catch(() => fileID);
}

Page({
  data: {
    previewMode: false,
    loading: true,
    saving: false,
    elder: null,
    elderAvatarSrc: "/assets/images/avatar1.png",
    selfMemories: [],
    phone: ""
  },

  onLoad(options = {}) {
    this.setData({ previewMode: isPreviewMode(options) });
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });

    try {
      if (this.data.previewMode) {
        const selfMemories = previewMemories
          .filter((item) => item && item.personRole === "self")
          .sort((a, b) => (a.year || 0) - (b.year || 0));

        this.setData({
          elder: { ...previewElderProfile },
          elderAvatarSrc: (previewElderProfile && previewElderProfile.avatar) || "/assets/images/avatar1.png",
          selfMemories,
          phone: previewElderProfile.phone || "",
          loading: false
        });
        return;
      }

      const elder = await getElderInfoAPI();
      const memoriesRaw = await getMemoriesAPI({});
      const memories = Array.isArray(memoriesRaw)
        ? memoriesRaw
        : (memoriesRaw && Array.isArray(memoriesRaw.data) ? memoriesRaw.data : []);

      const avatarUrl = await resolveTempFileURL((elder && elder.avatar) || "");
      const name = elder && elder.name ? elder.name.trim() : "";
      const selfKeys = ["本人", "自己", "我"];
      const selfMemories = (memories || [])
        .filter((m) => {
          if (m && m.personRole === "self") return true;
          const person = (m.person || "").trim();
          if (!person) return false;
          if (selfKeys.includes(person)) return true;
          if (name && person === name) return true;
          return false;
        })
        .sort((a, b) => (a.year || 0) - (b.year || 0));

      this.setData({
        elderAvatarSrc: avatarUrl || "/assets/images/avatar1.png",
        elder: elder
          ? {
              ...elder,
              avatarUrl
            }
          : null,
        selfMemories,
        phone: (elder && elder.phone) || "",
        loading: false
      });
    } catch (error) {
      console.error("load elder profile failed", error);
      this.setData({
        loading: false,
        elderAvatarSrc: "/assets/images/avatar1.png"
      });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  handleAvatarError() {
    this.setData({
      elderAvatarSrc: "/assets/images/avatar1.png"
    });
  },

  async savePhone() {
    if (this.data.saving) return;
    if (this.data.previewMode) {
      wx.showToast({
        title: "体验模式仅供浏览，登录后可绑定手机号",
        icon: "none"
      });
      return;
    }

    try {
      this.setData({ saving: true });
      wx.showLoading({ title: "保存中..." });
      await updateElderInfoAPI({
        phone: this.data.phone.trim()
      });
      wx.hideLoading();
      this.setData({
        elder: {
          ...(this.data.elder || {}),
          phone: this.data.phone.trim()
        }
      });
      wx.showToast({ title: "保存成功", icon: "success" });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: (error && (error.message || error.errMsg)) || "保存失败",
        icon: "none"
      });
    } finally {
      this.setData({ saving: false });
    }
  }
});
