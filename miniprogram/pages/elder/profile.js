const { getElderInfoAPI, getMemoriesAPI, updateElderInfoAPI } = require("../../api/user");

Page({
  data: {
    loading: true,
    saving: false,
    elder: null,
    selfMemories: [],
    phone: ""
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });

    try {
      const elder = await getElderInfoAPI();
      const memoriesRaw = await getMemoriesAPI({});
      const memories = Array.isArray(memoriesRaw)
        ? memoriesRaw
        : (memoriesRaw && Array.isArray(memoriesRaw.data) ? memoriesRaw.data : []);

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
        elder,
        selfMemories,
        phone: (elder && elder.phone) || "",
        loading: false
      });
    } catch (error) {
      console.error("load elder profile failed", error);
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  async savePhone() {
    if (this.data.saving) return;

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
