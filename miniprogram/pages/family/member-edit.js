// pages/family/member-edit.js
const {
  getPersonDetailAPI,
  addPersonAPI,
  updatePersonAPI,
  deletePersonAPI
} = require("../../api/user");

Page({
  data: {
    isEdit: false,
    personId: "",
    name: "",
    relation: "",
    age: "",
    gender: "",
    health: "",
    description: "",
    avatar: "",
    relationOptions: ["祖父", "祖母", "父亲", "母亲", "叔叔", "姑姑", "本人", "儿子", "女儿", "孙子", "孙女", "其他"],
    genderOptions: ["男", "女"],
    showRelationPicker: false,
    showGenderPicker: false,
    saving: false
  },

  noop() {},

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, personId: options.id });
      this.loadPersonDetail(options.id);
    }
  },

  async loadPersonDetail(personId) {
    try {
      wx.showLoading({ title: "加载中..." });
      const person = await getPersonDetailAPI(personId);

      this.setData({
        name: person.name || "",
        relation: person.relation || "",
        age: person.age ? String(person.age) : "",
        gender: person.gender || "",
        health: person.health || "",
        description: person.description || "",
        avatar: person.avatar || ""
      });

      wx.hideLoading();
    } catch (error) {
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

  showRelationPicker() {
    this.setData({ showRelationPicker: true });
  },

  hideRelationPicker() {
    this.setData({ showRelationPicker: false });
  },

  showGenderPicker() {
    this.setData({ showGenderPicker: true });
  },

  hideGenderPicker() {
    this.setData({ showGenderPicker: false });
  },

  onRelationChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    const relation = this.data.relationOptions[index] || "";
    this.setData({ relation, showRelationPicker: false });
  },

  onGenderChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    const gender = this.data.genderOptions[index] || "";
    this.setData({ gender, showGenderPicker: false });
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempPath = res.tempFilePaths[0];
        this.setData({ avatar: tempPath });
      }
    });
  },

  removeAvatar() {
    this.setData({ avatar: "" });
  },

  uploadToCloud(tempFilePath) {
    return new Promise((resolve, reject) => {
      const extMatch = tempFilePath.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : ".jpg";
      const cloudPath = `member-avatars/${Date.now()}-${Math.random().toString(36).slice(2, 11)}${ext}`;

      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  async save() {
    const { name, relation, age, gender, health, description, avatar, isEdit, personId, saving } = this.data;

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
        avatarUrl = await this.uploadToCloud(avatar);
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
        avatar: avatarUrl || ""
      };

      if (isEdit) {
        await updatePersonAPI({ personId, ...data });
      } else {
        await addPersonAPI(data);
      }

      wx.hideLoading();
      wx.showToast({ title: "保存成功", icon: "success" });
      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }

    this.setData({ saving: false });
  },

  delete() {
    wx.showModal({
      title: "确认删除",
      content: "删除后无法恢复，确定要删除这位成员吗？",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

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
  }
});
