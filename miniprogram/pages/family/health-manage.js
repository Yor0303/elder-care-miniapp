const {
  getHealthInfoAPI,
  addMedicalHistoryAPI,
  addMedicationAPI,
  addHealthMeasurementAPI,
  deleteHealthRecordAPI
} = require("../../api/user");

function todayDateString() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDateLabel(value) {
  if (!value) return "--";
  return String(value).slice(5);
}

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

function buildBloodPressureTrend(list) {
  const maxSystolic = Math.max(...list.map((item) => item.systolic || 0), 160);
  const maxDiastolic = Math.max(...list.map((item) => item.diastolic || 0), 100);
  return list.map((item) => ({
    ...item,
    label: formatDateLabel(item.date),
    systolicWidth: `${Math.max(12, Math.min(100, Math.round(((item.systolic || 0) / maxSystolic) * 100)))}%`,
    diastolicWidth: `${Math.max(12, Math.min(100, Math.round(((item.diastolic || 0) / maxDiastolic) * 100)))}%`
  }));
}

function buildSingleTrend(list, maxBase) {
  const maxValue = Math.max(...list.map((item) => item.value || 0), maxBase);
  return list.map((item) => ({
    ...item,
    label: formatDateLabel(item.date),
    width: `${Math.max(12, Math.min(100, Math.round(((item.value || 0) / maxValue) * 100)))}%`
  }));
}

Page({
  data: {
    loading: false,
    todayHealth: {
      bloodPressure: "",
      heartRate: "",
      bloodSugar: ""
    },
    todayCards: [],
    medicalHistory: [],
    medications: [],
    measurementHistory: [],
    healthAlerts: [],
    bloodPressureTrend: [],
    bloodSugarTrend: [],
    latestMeasurement: null,
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
      const todayHealth = healthInfo.todayHealth || {
        bloodPressure: "",
        heartRate: "",
        bloodSugar: ""
      };

      this.setData({
        todayHealth,
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
        medicalHistory: Array.isArray(healthInfo.medicalHistory) ? healthInfo.medicalHistory : [],
        medications: Array.isArray(healthInfo.medications) ? healthInfo.medications : [],
        measurementHistory: Array.isArray(healthInfo.measurementHistory) ? healthInfo.measurementHistory : [],
        healthAlerts: Array.isArray(healthInfo.healthAlerts) ? healthInfo.healthAlerts : [],
        bloodPressureTrend: buildBloodPressureTrend((healthInfo.healthTrend && healthInfo.healthTrend.bloodPressure) || []),
        bloodSugarTrend: buildSingleTrend((healthInfo.healthTrend && healthInfo.healthTrend.bloodSugar) || [], 10),
        latestMeasurement: healthInfo.latestMeasurement || null,
        loading: false
      });
    } catch (error) {
      console.error("加载健康信息失败:", error);
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  noop() {},

  showAddMeasurement() {
    this.setData({
      showAddModal: true,
      addType: "measurement",
      newRecord: {
        recordDate: todayDateString(),
        bloodPressure: "",
        heartRate: "",
        bloodSugar: "",
        notes: ""
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

  onDateChange(e) {
    this.setData({
      "newRecord.recordDate": e.detail.value
    });
  },

  async submitNewRecord() {
    const { addType, newRecord } = this.data;

    try {
      if (addType === "measurement") {
        await addHealthMeasurementAPI({
          recordDate: newRecord.recordDate,
          bloodPressure: (newRecord.bloodPressure || "").trim(),
          heartRate: (newRecord.heartRate || "").trim(),
          bloodSugar: (newRecord.bloodSugar || "").trim(),
          notes: (newRecord.notes || "").trim()
        });
      } else if (addType === "history") {
        if (!newRecord.name || !newRecord.name.trim()) {
          wx.showToast({ title: "请输入名称", icon: "none" });
          return;
        }
        await addMedicalHistoryAPI({
          name: newRecord.name.trim(),
          diagnoseYear: parseInt(newRecord.diagnoseYear, 10) || new Date().getFullYear(),
          notes: (newRecord.notes || "").trim()
        });
      } else if (addType === "medication") {
        if (!newRecord.name || !newRecord.name.trim()) {
          wx.showToast({ title: "请输入名称", icon: "none" });
          return;
        }
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
      wx.showToast({ title: "保存成功", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
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
