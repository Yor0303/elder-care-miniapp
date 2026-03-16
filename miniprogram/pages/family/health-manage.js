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

    // 今日健康数据
    todayHealth: {
      bloodPressure: "",
      heartRate: "",
      bloodSugar: ""
    },

    // 既往病史
    medicalHistory: [],

    // 当前用药
    medications: [],

    // 编辑弹窗
    showAddModal: false,
    addType: "", // "history" 或 "medication"
    newRecord: {}
  },

  onLoad() {
    this.loadHealthInfo();
  },

  onShow() {
    this.loadHealthInfo();
  },

  /**
   * 加载健康信息
   */
  async loadHealthInfo() {
    this.setData({ loading: true });

    try {
      const healthInfo = await getHealthInfoAPI();

      this.setData({
        todayHealth: healthInfo.todayHealth,
        medicalHistory: healthInfo.medicalHistory,
        medications: healthInfo.medications,
        loading: false
      });

    } catch (error) {
      console.error("加载健康信息失败:", error);
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadHealthInfo();
    wx.stopPullDownRefresh();
  },

  /**
   * 编辑今日健康数据
   */
  editTodayHealth() {
    const { todayHealth } = this.data;

    wx.showModal({
      title: "更新今日健康数据",
      content: "血压: " + (todayHealth.bloodPressure || "--/--"),
      editable: true,
      placeholderText: "请输入血压值（如 120/80）",
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await updateTodayHealthAPI({ bloodPressure: res.content });
            await this.loadHealthInfo();
            wx.showToast({ title: "更新成功", icon: "success" });
          } catch (error) {
            wx.showToast({ title: "更新失败", icon: "none" });
          }
        }
      }
    });
  },

  editHeartRate() {
    wx.showModal({
      title: "更新心率",
      editable: true,
      placeholderText: "请输入心率（次/分钟）",
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await updateTodayHealthAPI({ heartRate: parseInt(res.content) });
            await this.loadHealthInfo();
            wx.showToast({ title: "更新成功", icon: "success" });
          } catch (error) {
            wx.showToast({ title: "更新失败", icon: "none" });
          }
        }
      }
    });
  },

  editBloodSugar() {
    wx.showModal({
      title: "更新血糖",
      editable: true,
      placeholderText: "请输入血糖值（mmol/L）",
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await updateTodayHealthAPI({ bloodSugar: res.content });
            await this.loadHealthInfo();
            wx.showToast({ title: "更新成功", icon: "success" });
          } catch (error) {
            wx.showToast({ title: "更新失败", icon: "none" });
          }
        }
      }
    });
  },

  /**
   * 显示添加病史弹窗
   */
  showAddHistory() {
    this.setData({
      showAddModal: true,
      addType: "history",
      newRecord: {
        name: "",
        diagnoseYear: new Date().getFullYear(),
        notes: ""
      }
    });
  },

  /**
   * 显示添加用药弹窗
   */
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

  /**
   * 关闭弹窗
   */
  closeModal() {
    this.setData({ showAddModal: false });
  },

  /**
   * 输入框变化
   */
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`newRecord.${field}`]: e.detail.value
    });
  },

  /**
   * 提交新记录
   */
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
          diagnoseYear: parseInt(newRecord.diagnoseYear) || new Date().getFullYear(),
          notes: newRecord.notes || ""
        });
      } else {
        await addMedicationAPI({
          name: newRecord.name.trim(),
          frequency: newRecord.frequency || "",
          dosage: newRecord.dosage || "",
          time: newRecord.time || "",
          notes: newRecord.notes || ""
        });
      }

      this.setData({ showAddModal: false });
      await this.loadHealthInfo();
      wx.showToast({ title: "添加成功", icon: "success" });

    } catch (error) {
      console.error("添加失败:", error);
      wx.showToast({ title: "添加失败", icon: "none" });
    }
  },

  /**
   * 删除记录
   */
  deleteRecord(e) {
    const { id, type } = e.currentTarget.dataset;

    wx.showModal({
      title: "确认删除",
      content: "删除后无法恢复，确定要删除吗？",
      success: async (res) => {
        if (res.confirm) {
          try {
            await deleteHealthRecordAPI(id);
            await this.loadHealthInfo();
            wx.showToast({ title: "删除成功", icon: "success" });
          } catch (error) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  }
});
