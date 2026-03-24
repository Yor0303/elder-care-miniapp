const { getHealthInfoAPI, updateTodayHealthAPI } = require("../../api/user");

Page({
  data: {
    loading: false,
    errorMsg: "",
    todayHealth: {
      bloodPressure: "--/--",
      heartRate: "--",
      bloodSugar: "--"
    },
    medicalHistory: [],
    medications: []
  },

  onLoad() {
    this.loadHealthInfo();
  },

  async loadHealthInfo() {
    this.setData({
      loading: true,
      errorMsg: ""
    });

    try {
      const healthInfo = await getHealthInfoAPI();

      this.setData({
        todayHealth: healthInfo.todayHealth || {
          bloodPressure: "--/--",
          heartRate: "--",
          bloodSugar: "--"
        },
        medicalHistory: Array.isArray(healthInfo.medicalHistory) ? healthInfo.medicalHistory : [],
        medications: Array.isArray(healthInfo.medications) ? healthInfo.medications : [],
        loading: false
      });
    } catch (error) {
      console.error("加载健康信息失败:", error);
      this.setData({
        loading: false,
        errorMsg: error.message || "加载失败，请重试"
      });

      wx.showToast({
        title: "加载失败",
        icon: "none"
      });
    }
  },

  async onPullDownRefresh() {
    await this.loadHealthInfo();
    wx.stopPullDownRefresh();
  },

  updateHealthData() {
    wx.showModal({
      title: "更新血压",
      editable: true,
      placeholderText: "请输入血压值，例如 120/80",
      success: async (res) => {
        if (!res.confirm || !res.content) {
          return;
        }

        try {
          await updateTodayHealthAPI({
            bloodPressure: res.content.trim()
          });
          await this.loadHealthInfo();
          wx.showToast({
            title: "更新成功",
            icon: "success"
          });
        } catch (error) {
          wx.showToast({
            title: "更新失败",
            icon: "none"
          });
        }
      }
    });
  }
});
