const { getHealthInfoAPI } = require("../../api/user");

function parseBloodPressure(value) {
  const matched = String(value || "").match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!matched) return { systolic: null, diastolic: null };
  return {
    systolic: Number.parseInt(matched[1], 10),
    diastolic: Number.parseInt(matched[2], 10)
  };
}

function getMetricStatus(metric, value) {
  if (metric === "bloodPressure") {
    const pressure = parseBloodPressure(value);
    if (!pressure.systolic || !pressure.diastolic) return { text: "待记录", type: "normal" };
    if (pressure.systolic >= 140 || pressure.diastolic >= 90) return { text: "偏高", type: "high" };
    if (pressure.systolic < 90 || pressure.diastolic < 60) return { text: "偏低", type: "low" };
    return { text: "正常", type: "normal" };
  }

  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) return { text: "待记录", type: "normal" };
  if (metric === "bloodSugar") {
    if (num > 7.8) return { text: "偏高", type: "high" };
    if (num < 3.9) return { text: "偏低", type: "low" };
    return { text: "平稳", type: "normal" };
  }
  if (metric === "heartRate") {
    if (num > 100) return { text: "偏快", type: "high" };
    if (num < 50) return { text: "偏慢", type: "low" };
    return { text: "平稳", type: "normal" };
  }
  return { text: "正常", type: "normal" };
}

Page({
  data: {
    loading: false,
    errorMsg: "",
    todayCards: [],
    healthAlerts: [],
    latestMeasurement: null
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
      const todayHealth = healthInfo.todayHealth || {
        bloodPressure: "",
        heartRate: "",
        bloodSugar: ""
      };

      this.setData({
        todayCards: [
          {
            key: "bloodPressure",
            label: "血压",
            value: todayHealth.bloodPressure || "--/--",
            unit: "",
            status: getMetricStatus("bloodPressure", todayHealth.bloodPressure)
          },
          {
            key: "heartRate",
            label: "心率",
            value: todayHealth.heartRate || "--",
            unit: "次/分钟",
            status: getMetricStatus("heartRate", todayHealth.heartRate)
          },
          {
            key: "bloodSugar",
            label: "血糖",
            value: todayHealth.bloodSugar || "--",
            unit: "mmol/L",
            status: getMetricStatus("bloodSugar", todayHealth.bloodSugar)
          }
        ],
        healthAlerts: Array.isArray(healthInfo.healthAlerts) ? healthInfo.healthAlerts : [],
        latestMeasurement: healthInfo.latestMeasurement || null,
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
  }
});
