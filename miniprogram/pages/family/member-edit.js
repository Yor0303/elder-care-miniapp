// pages/family/member-edit.js
const { getPersonDetailAPI, addPersonAPI, updatePersonAPI, deletePersonAPI } = require("../../api/user");

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

    relationOptions: ["祖父", "祖母", "父亲", "母亲", "叔叔", "姑姑", "本人", "儿子", "女儿", "孙子", "孙女", "其他"],
    genderOptions: ["男", "女"],
    showRelationPicker: false,
    showGenderPicker: false,

    saving: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, personId: options.id });
      this.loadPersonDetail(options.id);
    }
  },

  async loadPersonDetail(personId) {
    try {
      wx.showLoading({ title: "加载中" });
      const person = await getPersonDetailAPI(personId);

      this.setData({
        name: person.name || "",
        relation: person.relation || "",
        age: person.age ? String(person.age) : "",
        gender: person.gender || "",
        health: person.health || "",
        description: person.description || ""
      });

      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  // 输入事件
  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onAgeInput(e) { this.setData({ age: e.detail.value }); },
  onHealthInput(e) { this.setData({ health: e.detail.value }); },
  onDescriptionInput(e) { this.setData({ description: e.detail.value }); },

  // 选择器
  showRelationPicker() { this.setData({ showRelationPicker: true }); },
  hideRelationPicker() { this.setData({ showRelationPicker: false }); },

  showGenderPicker() { this.setData({ showGenderPicker: true }); },
  hideGenderPicker() { this.setData({ showGenderPicker: false }); },

  onRelationChange(e) {
    this.setData({
      relation: this.data.relationOptions[e.detail.value],
      showRelationPicker: false
    });
  },

  onGenderChange(e) {
    this.setData({
      gender: this.data.genderOptions[e.detail.value],
      showGenderPicker: false
    });
  },

  // 保存
  async save() {
    const { name, relation, age, gender, health, description, isEdit, personId, saving } = this.data;

    if (!name.trim()) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return;
    }

    if (saving) return;
    this.setData({ saving: true });

    try {
      const data = {
        name: name.trim(),
        relation,
        age: age ? parseInt(age) : null,
        gender,
        health,
        description
      };

      if (isEdit) {
        await updatePersonAPI({ personId, ...data });
      } else {
        await addPersonAPI(data);
      }

      wx.showToast({ title: "保存成功", icon: "success" });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }

    this.setData({ saving: false });
  },

  // 删除
  delete() {
    wx.showModal({
      title: "确认删除",
      content: "删除后无法恢复，确定要删除吗？",
      success: async (res) => {
        if (res.confirm) {
          try {
            await deletePersonAPI(this.data.personId);
            wx.showToast({ title: "删除成功", icon: "success" });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (error) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  }
});
