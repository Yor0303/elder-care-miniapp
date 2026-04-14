// pages/family/member-edit.js
const {
  getPersonDetailAPI,
  addPersonAPI,
  updatePersonAPI,
  deletePersonAPI
} = require("../../api/user");

function getActionValue(e) {
  return (
    (e && e.detail && e.detail.value) ||
    (e && e.detail && e.detail.item && e.detail.item.value) ||
    (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.value) ||
    ""
  );
}

function isUnsupportedFaceImage(tempFilePath = "") {
  return /\.(heic|heif)$/i.test(tempFilePath);
}

Page({
  data: {
    loading: false,
    isEdit: false,
    personId: "",
    name: "",
    relation: "",
    age: "",
    gender: "",
    health: "",
    description: "",
    avatar: "",
    facePhoto: "",
    relationOptions: ["祖父", "祖母", "父亲", "母亲", "叔叔", "姑姑", "本人", "儿子", "女儿", "孙子", "孙女", "其他"],
    genderOptions: ["男", "女"],
    showRelationSheet: false,
    showGenderSheet: false,
    showDeleteDialog: false,
    saving: false,
    avatarFiles: [],
    facePhotoFiles: [],
    relationActionItems: [],
    genderActionItems: [],
    deleteDialogButtons: [],
    selectAvatarFile: null,
    uploadAvatarFile: null,
    selectFacePhotoFile: null,
    uploadFacePhotoFile: null
  },

  onLoad(options) {
    this.setData({
      relationActionItems: this.data.relationOptions.map((item) => ({ text: item, value: item })),
      genderActionItems: this.data.genderOptions.map((item) => ({ text: item, value: item })),
      deleteDialogButtons: [
        { text: "取消", value: "cancel" },
        { text: "删除", value: "delete", className: "weui-dialog__btn_warn" }
      ],
      selectAvatarFile: this.selectAvatarFile.bind(this),
      uploadAvatarFile: this.uploadAvatarFile.bind(this),
      selectFacePhotoFile: this.selectFacePhotoFile.bind(this),
      uploadFacePhotoFile: this.uploadFacePhotoFile.bind(this),
      loading: !!options.id
    });

    if (options.id) {
      this.setData({ isEdit: true, personId: options.id });
      this.loadPersonDetail(options.id);
    }
  },

  async loadPersonDetail(personId) {
    try {
      wx.showLoading({ title: "加载中..." });
      const person = await getPersonDetailAPI(personId);
      const avatar = person.avatar || "";
      const facePhoto = person.facePhoto || person.avatar || "";

      this.setData({
        name: person.name || "",
        relation: person.relation || "",
        age: person.age ? String(person.age) : "",
        gender: person.gender || "",
        health: person.health || "",
        description: person.description || "",
        avatar,
        facePhoto,
        avatarFiles: avatar ? [{ url: avatar }] : [],
        facePhotoFiles: facePhoto ? [{ url: facePhoto }] : [],
        loading: false
      });

      wx.hideLoading();
    } catch (error) {
      this.setData({ loading: false });
      wx.hideLoading();
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onAgeInput(e) {
    this.setData({ age: e.detail.value });
  },

  onHealthInput(e) {
    this.setData({ health: e.detail.value });
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value });
  },

  selectAvatarFile() {
    return true;
  },

  uploadAvatarFile({ tempFilePaths }) {
    return Promise.all(tempFilePaths.map((item) => this.uploadToCloud(item, "member-avatars"))).then((urls) => ({ urls }));
  },

  selectFacePhotoFile() {
    return true;
  },

  uploadFacePhotoFile({ tempFilePaths }) {
    return Promise.all(tempFilePaths.map((item) => this.uploadToCloud(item, "member-faces"))).then((urls) => ({ urls }));
  },

  onAvatarUploadSuccess(e) {
    const url = (e.detail.urls && e.detail.urls[0]) || "";
    this.setData({
      avatar: url,
      avatarFiles: url ? [{ url }] : []
    });
  },

  onFacePhotoUploadSuccess(e) {
    const url = (e.detail.urls && e.detail.urls[0]) || "";
    this.setData({
      facePhoto: url,
      facePhotoFiles: url ? [{ url }] : []
    });
  },

  onAvatarUploadFail() {
    this.setData({
      avatarFiles: this.data.avatar ? [{ url: this.data.avatar }] : []
    });
    wx.showToast({ title: "头像上传失败", icon: "none" });
  },

  onFacePhotoUploadFail() {
    this.setData({
      facePhotoFiles: this.data.facePhoto ? [{ url: this.data.facePhoto }] : []
    });
    wx.showToast({ title: "人脸照上传失败", icon: "none" });
  },

  onAvatarDelete() {
    this.setData({
      avatar: "",
      avatarFiles: []
    });
  },

  onFacePhotoDelete() {
    this.setData({
      facePhoto: "",
      facePhotoFiles: []
    });
  },

  openRelationSheet() {
    this.setData({ showRelationSheet: true });
  },

  closeRelationSheet() {
    this.setData({ showRelationSheet: false });
  },

  onRelationActionTap(e) {
    const relation = getActionValue(e);
    this.setData({
      relation,
      showRelationSheet: false
    });
  },

  openGenderSheet() {
    this.setData({ showGenderSheet: true });
  },

  closeGenderSheet() {
    this.setData({ showGenderSheet: false });
  },

  onGenderActionTap(e) {
    const gender = getActionValue(e);
    this.setData({
      gender,
      showGenderSheet: false
    });
  },

  uploadToCloud(tempFilePath, folder = "member-avatars") {
    return new Promise((resolve, reject) => {
      if (folder === "member-faces" && isUnsupportedFaceImage(tempFilePath)) {
        reject(new Error("人脸照暂不支持 HEIC/HEIF，请改用 JPG 或 PNG 格式"));
        return;
      }

      const extMatch = tempFilePath.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : ".jpg";
      const cloudPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 11)}${ext}`;

      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  async save() {
    const { name, relation, age, gender, health, description, avatar, facePhoto, isEdit, personId, saving } = this.data;

    if (!name.trim()) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return;
    }

    if (saving) {
      return;
    }
    this.setData({ saving: true });

    try {
      let avatarUrl = avatar;
      if (avatar && avatar.startsWith("wxfile://")) {
        wx.showLoading({ title: "上传头像中..." });
        avatarUrl = await this.uploadToCloud(avatar, "member-avatars");
      }

      let facePhotoUrl = facePhoto;
      if (facePhoto && facePhoto === avatar) {
        facePhotoUrl = avatarUrl;
      } else if (facePhoto && facePhoto.startsWith("wxfile://")) {
        wx.showLoading({ title: "上传人脸照中..." });
        facePhotoUrl = await this.uploadToCloud(facePhoto, "member-faces");
      }

      wx.showLoading({ title: "保存中..." });
      const parsedAge = parseInt(age, 10);
      const data = {
        name: name.trim(),
        relation,
        age: Number.isFinite(parsedAge) ? parsedAge : null,
        gender,
        health,
        description,
        avatar: avatarUrl || "",
        facePhoto: facePhotoUrl || avatarUrl || ""
      };

      let result;
      if (isEdit) {
        result = await updatePersonAPI({ personId, ...data });
      } else {
        result = await addPersonAPI(data);
      }

      wx.hideLoading();
      if (result && result.faceSyncWarning) {
        wx.showModal({
          title: "已保存成员",
          content: `成员资料已保存，但人脸同步失败：${result.faceSyncWarning}`,
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      } else {
        wx.showToast({ title: "保存成功", icon: "success" });
        setTimeout(() => {
          wx.navigateBack();
        }, 1200);
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }

    this.setData({ saving: false });
  },

  openDeleteDialog() {
    this.setData({ showDeleteDialog: true });
  },

  closeDeleteDialog() {
    this.setData({ showDeleteDialog: false });
  },

  async onDeleteDialogButtonTap(e) {
    const item = e.detail.item || {};
    if (item.value !== "delete") {
      this.setData({ showDeleteDialog: false });
      return;
    }

    this.setData({ showDeleteDialog: false });

    try {
      await deletePersonAPI(this.data.personId);
      wx.showToast({ title: "删除成功", icon: "success" });
      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
    } catch (error) {
      wx.showToast({ title: "删除失败", icon: "none" });
    }
  }
});
