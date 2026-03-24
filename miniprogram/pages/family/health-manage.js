// pages/family/health-manage.js
const {
  getHealthInfoAPI,
  addMedicalHistoryAPI,
  addMedicationAPI,
  updateTodayHealthAPI,
  deleteHealthRecordAPI
} = require("../../api/user");

Page({
  data: {
    loading: false,
    todayHealth: {
      bloodPressure: "",
      heartRate: "",
      bloodSugar: ""
    },
    medicalHistory: [],
    medications: [],
    showAddModal: false,
    addType: "",
    newRecord: {}
  },

  onLoad() {
    this.loadHealthInfo();
  },

  onShow() {
    this.loadHealthInfo();
  },

  async onPullDownRefresh() {
    await this.loadHealthInfo();
    wx.stopPullDownRefresh();
  },

  async loadHealthInfo() {
    this.setData({ loading: true });
    try {
      const healthInfo = await getHealthInfoAPI();
      this.setData({
        todayHealth: healthInfo.todayHealth || {
          bloodPressure: "",
          heartRate: "",
          bloodSugar: ""
        },
        medicalHistory: Array.isArray(healthInfo.medicalHistory) ? healthInfo.medicalHistory : [],
        medications: Array.isArray(healthInfo.medications) ? healthInfo.medications : [],
        loading: false
      });
    } catch (error) {
      console.error("加载健康信息失败:", error);
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  noop() {},

  async editTodayHealth() {
    const { todayHealth } = this.data;
    wx.showModal({
      title: "更新今日血压",
      content: `血压：${todayHealth.bloodPressure || "--/--"}`,
      editable: true,
      placeholderText: "请输入血压，例如 120/80",
      success: async (res) => {
        if (!res.confirm || !res.content) return;
        try {
          await updateTodayHealthAPI({ bloodPressure: res.content.trim() });
          await this.loadHealthInfo();
          wx.showToast({ title: "更新成功", icon: "success" });
        } catch (error) {
          wx.showToast({ title: "更新失败", icon: "none" });
        }
      }
    });
  },

  async editHeartRate() {
    wx.showModal({
      title: "更新心率",
      editable: true,
      placeholderText: "请输入心率，例如 72",
      success: async (res) => {
        if (!res.confirm || !res.content) return;
        try {
          await updateTodayHealthAPI({ heartRate: parseInt(res.content, 10) });
          await this.loadHealthInfo();
          wx.showToast({ title: "更新成功", icon: "success" });
        } catch (error) {
          wx.showToast({ title: "更新失败", icon: "none" });
        }
      }
    });
  },

  async editBloodSugar() {
    wx.showModal({
      title: "更新血糖",
      editable: true,
      placeholderText: "请输入血糖，例如 5.6",
      success: async (res) => {
        if (!res.confirm || !res.content) return;
        try {
          await updateTodayHealthAPI({ bloodSugar: res.content.trim() });
          await this.loadHealthInfo();
          wx.showToast({ title: "更新成功", icon: "success" });
        } catch (error) {
          wx.showToast({ title: "更新失败", icon: "none" });
        }
      }
    });
  },

  showAddHistory() {
    this.setData({
      showAddModal: true,
      addType: "history",
      newRecord: {
        name: "",
        diagnoseYear: String(new Date().getFullYear()),
        notes: ""
      }
    });
  },

  showAddMedication() {
    this.setData({
      showAddModal: true,
      addType: "medication",
      newRecord: {
        name: "",
        frequency: "",
        dosage: "",
        time: "",
        notes: ""
      }
    });
  },

  closeModal() {
    this.setData({
      showAddModal: false,
      addType: "",
      newRecord: {}
    });
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`newRecord.${field}`]: e.detail.value
    });
  },

  async submitNewRecord() {
    const { addType, newRecord } = this.data;
    if (!newRecord.name || !newRecord.name.trim()) {
      wx.showToast({ title: "请输入名称", icon: "none" });
      return;
    }

    try {
      if (addType === "history") {
        await addMedicalHistoryAPI({
          name: newRecord.name.trim(),
          diagnoseYear: parseInt(newRecord.diagnoseYear, 10) || new Date().getFullYear(),
          notes: (newRecord.notes || "").trim()
        });
      } else if (addType === "medication") {
        await addMedicationAPI({
          name: newRecord.name.trim(),
          frequency: (newRecord.frequency || "").trim(),
          dosage: (newRecord.dosage || "").trim(),
          time: (newRecord.time || "").trim(),
          notes: (newRecord.notes || "").trim()
        });
      }

      this.closeModal();
      await this.loadHealthInfo();
      wx.showToast({ title: "添加成功", icon: "success" });
    } catch (error) {
      console.error("添加健康记录失败:", error);
      wx.showToast({ title: "添加失败", icon: "none" });
    }
  },

  deleteRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: "确认删除",
      content: "删除后无法恢复，确定要删除吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await deleteHealthRecordAPI(id);
          await this.loadHealthInfo();
          wx.showToast({ title: "删除成功", icon: "success" });
        } catch (error) {
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      }
    });
  }
});
