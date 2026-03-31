// pages/family/profile.js
const { getElderInfoAPI, updateElderInfoAPI } = require("../../api/user");

Page({
  data: {
    loading: true,
    saving: false,

    avatar: "",
    name: "",
    phone: "",
    gender: "",
    age: "",
    birthYear: "",
    hometown: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    allergies: "",
    medications: "",
    notes: "",

    genderOptions: ["男", "女", "未填"],
    genderIndex: -1
  },

  onLoad() {
    this.loadElderInfo();
  },

  async loadElderInfo() {
    this.setData({ loading: true });
    try {
      const elder = await getElderInfoAPI();
      const genderIndex = this.getGenderIndex(elder && elder.gender);

      this.setData({
        avatar: elder.avatar || "",
        name: elder.name || "",
        phone: elder.phone || "",
        gender: elder.gender || "",
        age: elder.age || "",
        birthYear: elder.birthYear || "",
        hometown: elder.hometown || "",
        address: elder.address || "",
        emergencyContactName: elder.emergencyContactName || "",
        emergencyContactPhone: elder.emergencyContactPhone || "",
        allergies: elder.allergies || "",
        medications: elder.medications || "",
        notes: elder.notes || "",
        genderIndex,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  getGenderIndex(value) {
    const index = this.data.genderOptions.findIndex((item) => item === value);
    return index >= 0 ? index : -1;
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onAgeInput(e) { this.setData({ age: e.detail.value }); },
  onBirthYearInput(e) { this.setData({ birthYear: e.detail.value }); },
  onHometownInput(e) { this.setData({ hometown: e.detail.value }); },
  onAddressInput(e) { this.setData({ address: e.detail.value }); },
  onEmergencyContactNameInput(e) { this.setData({ emergencyContactName: e.detail.value }); },
  onEmergencyContactPhoneInput(e) { this.setData({ emergencyContactPhone: e.detail.value }); },
  onAllergiesInput(e) { this.setData({ allergies: e.detail.value }); },
  onMedicationsInput(e) { this.setData({ medications: e.detail.value }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  onGenderChange(e) {
    const index = Number(e.detail.value);
    const gender = this.data.genderOptions[index] || "";
    this.setData({ genderIndex: index, gender: gender === "未填" ? "" : gender });
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        this.setData({ avatar: res.tempFilePaths[0] });
      }
    });
  },

  uploadToCloud(tempFilePath) {
    return new Promise((resolve, reject) => {
      const extMatch = tempFilePath.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : ".jpg";
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;

      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  async save() {
    if (this.data.saving) return;
    this.setData({ saving: true });

    try {
      let avatarUrl = this.data.avatar;
      if (avatarUrl && avatarUrl.startsWith("wxfile://")) {
        wx.showLoading({ title: "上传头像..." });
        avatarUrl = await this.uploadToCloud(avatarUrl);
      }

      const ageValue = parseInt(this.data.age, 10);
      const birthYearValue = parseInt(this.data.birthYear, 10);

      wx.showLoading({ title: "保存中..." });
      await updateElderInfoAPI({
        avatar: avatarUrl || "",
        name: this.data.name.trim(),
        phone: this.data.phone.trim(),
        gender: this.data.gender,
        age: Number.isFinite(ageValue) ? ageValue : null,
        birthYear: Number.isFinite(birthYearValue) ? birthYearValue : "",
        hometown: this.data.hometown.trim(),
        address: this.data.address.trim(),
        emergencyContactName: this.data.emergencyContactName.trim(),
        emergencyContactPhone: this.data.emergencyContactPhone.trim(),
        allergies: this.data.allergies.trim(),
        medications: this.data.medications.trim(),
        notes: this.data.notes.trim()
      });

      wx.hideLoading();
      wx.showToast({ title: "保存成功", icon: "success" });
    } catch (error) {
      wx.hideLoading();
      const message = error && (error.message || error.errMsg) ? (error.message || error.errMsg) : "保存失败";
      wx.showToast({ title: message, icon: "none" });
    }

    this.setData({ saving: false });
  }
});
