const {
  getHealthInfoAPI,
  addMedicalHistoryAPI,
  addMedicationAPI,
  updateTodayHealthAPI,
  deleteHealthRecordAPI
} = require("../../api/user");

function parsePressure(value) {
  if (!value || typeof value !== "string") {
    return { systolic: null, diastolic: null };
  }

  const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) {
    return { systolic: null, diastolic: null };
  }

  return {
    systolic: Number(match[1]),
    diastolic: Number(match[2])
  };
}

function formatFriendlyLabel(value) {
  if (!value) return "--";
  const raw = String(value);
  const normalized = raw.includes("T") ? raw.slice(0, 10) : raw;
  const parts = normalized.split("-");
  if (parts.length === 3) {
    return `${Number(parts[1])}月${Number(parts[2])}日`;
  }

  if (raw.includes("/")) {
    const slashParts = raw.split("/");
    if (slashParts.length >= 2) {
      return `${Number(slashParts[0])}月${Number(slashParts[1])}日`;
    }
  }

  return raw;
}

function getPressureHeight(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 24;
  }

  return Math.max(24, Math.round(Number(value) / 2));
}

function toSortableTime(item = {}) {
  const source = item.date || item.dateKey || item.createdAt || "";
  const parsed = new Date(source).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeTrend(trend = []) {
  return Array.isArray(trend)
    ? trend
        .map((item) => ({
          ...item,
          label: formatFriendlyLabel(item.label || item.date),
          systolic: item.systolic === null || item.systolic === undefined ? null : Number(item.systolic),
          diastolic: item.diastolic === null || item.diastolic === undefined ? null : Number(item.diastolic),
          heartRate: item.heartRate === null || item.heartRate === undefined ? null : Number(item.heartRate),
          bloodSugar: item.bloodSugar === null || item.bloodSugar === undefined ? null : Number(item.bloodSugar)
        }))
        .sort((a, b) => toSortableTime(a) - toSortableTime(b))
    : [];
}

function buildMetricChart(trend, options) {
  const values = trend
    .map((item) => ({
      label: item.label || item.date || "--/--",
      value: item[options.key]
    }))
    .filter((item) => item.value !== null && item.value !== undefined && !Number.isNaN(item.value));

  if (!values.length) {
    return {
      key: options.key,
      title: options.title,
      unit: options.unit,
      empty: true,
      bars: [],
      latestValue: options.emptyValue
    };
  }

  const maxValue = Math.max(...values.map((item) => item.value), options.minScale || 1);
  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : null;

  return {
    key: options.key,
    title: options.title,
    unit: options.unit,
    empty: false,
    latestValue: latest ? latest.value : options.emptyValue,
    changeText:
      previous && latest
        ? latest.value === previous.value
          ? "较上一条保持稳定"
          : `较上一条${latest.value > previous.value ? "上升" : "下降"} ${Math.abs(latest.value - previous.value).toFixed(options.decimals || 0)}${options.unit}`
        : "记录满 2 条后显示变化",
    bars: values.map((item) => ({
      label: item.label,
      valueText: options.format ? options.format(item.value) : `${item.value}${options.unit}`,
      height: Math.max(18, Math.round((item.value / maxValue) * 120))
    }))
  };
}

function buildHealthViewModel(todayHealth, trend) {
  const parsedPressure = parsePressure(todayHealth.bloodPressure || "");
  const normalizedTrend = normalizeTrend(trend).map((item, index, list) => {
    if ((item.systolic !== null && item.diastolic !== null) || !list.length) {
      return item;
    }

    if (index === list.length - 1 && parsedPressure.systolic !== null && parsedPressure.diastolic !== null) {
      return {
        ...item,
        systolic: parsedPressure.systolic,
        diastolic: parsedPressure.diastolic
      };
    }

    return item;
  });

  const systolicMax = Math.max(...normalizedTrend.map((item) => item.systolic || 0), parsedPressure.systolic || 0, 1);
  const diastolicMax = Math.max(...normalizedTrend.map((item) => item.diastolic || 0), parsedPressure.diastolic || 0, 1);

  const pressureTrend = normalizedTrend.map((item) => ({
    ...item,
    systolicHeight:
      item.systolic === null || item.systolic === undefined
        ? 24
        : Math.max(52, Math.round((item.systolic / systolicMax) * 220)),
    diastolicHeight:
      item.diastolic === null || item.diastolic === undefined
        ? 24
        : Math.max(40, Math.round((item.diastolic / diastolicMax) * 180)),
    displayValue:
      item.systolic !== null && item.diastolic !== null ? `${item.systolic}/${item.diastolic}` : "--/--"
  }));

  return {
    pressureOverview: {
      current: todayHealth.bloodPressure || "--/--",
      systolic: parsedPressure.systolic,
      diastolic: parsedPressure.diastolic
    },
    chartCards: [
      buildMetricChart(normalizedTrend, {
        key: "heartRate",
        title: "心率趋势",
        unit: "次/分",
        emptyValue: "--",
        minScale: 60
      }),
      buildMetricChart(normalizedTrend, {
        key: "bloodSugar",
        title: "血糖趋势",
        unit: " mmol/L",
        emptyValue: "--",
        minScale: 8,
        decimals: 1,
        format: (value) => `${value} mmol/L`
      })
    ],
    pressureTrend: pressureTrend.slice(-7)
  };
}

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
    chartCards: [],
    pressureOverview: {
      current: "--/--",
      systolic: null,
      diastolic: null
    },
    pressureTrend: [],
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
      const viewModel = buildHealthViewModel(todayHealth, healthInfo.healthTrend || []);

      this.setData({
        todayHealth,
        medicalHistory: Array.isArray(healthInfo.medicalHistory) ? healthInfo.medicalHistory : [],
        medications: Array.isArray(healthInfo.medications) ? healthInfo.medications : [],
        chartCards: viewModel.chartCards,
        pressureOverview: viewModel.pressureOverview,
        pressureTrend: viewModel.pressureTrend,
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
      content: `当前血压：${todayHealth.bloodPressure || "--/--"}`,
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
        reminderEnabled: true,
        reminderTime: "09:00",
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

  onReminderSwitch(e) {
    this.setData({
      "newRecord.reminderEnabled": !!e.detail.value
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
          reminderEnabled: !!newRecord.reminderEnabled,
          reminderTime: newRecord.reminderEnabled ? (newRecord.reminderTime || "").trim() : "",
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
