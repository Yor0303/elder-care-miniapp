const {
  getHealthInfoAPI,
  addMedicalHistoryAPI,
  addMedicationAPI,
  updateMedicationAPI,
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
          ? "与上一条记录持平"
          : `较上一条${latest.value > previous.value ? "上升" : "下降"} ${Math.abs(
              latest.value - previous.value
            ).toFixed(options.decimals || 0)}${options.unit}`
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

function getTodayDateKey() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function normalizeWeekdays(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => item >= 1 && item <= 7)
    )
  ).sort((a, b) => a - b);
}

function getWeekdayLabel(day) {
  return ["一", "二", "三", "四", "五", "六", "日"][day - 1] || "";
}

function buildReminderScheduleText(item = {}) {
  if (!item.reminderEnabled || !item.reminderTime) return "";

  const type = item.reminderScheduleType || "daily";
  if (type === "once") {
    return `${item.reminderTime} 单次${item.reminderDate ? ` · ${item.reminderDate}` : ""}`;
  }

  if (type === "workday") {
    return `${item.reminderTime} 工作日`;
  }

  if (type === "weekly") {
    const days = normalizeWeekdays(item.reminderWeekdays)
      .map((day) => `周${getWeekdayLabel(day)}`)
      .join("、");
    return `${item.reminderTime} ${days || "按星期"}`;
  }

  return `${item.reminderTime} 每天`;
}

function buildMedicationForm(item = {}) {
  return {
    name: item.name || "",
    frequency: item.frequency || "",
    dosage: item.dosage || "",
    time: item.time || "",
    reminderEnabled:
      item.reminderEnabled === undefined || item.reminderEnabled === null ? true : !!item.reminderEnabled,
    reminderTime: item.reminderTime || "09:00",
    reminderScheduleType: item.reminderScheduleType || "daily",
    reminderDate: item.reminderDate || getTodayDateKey(),
    reminderWeekdays: normalizeWeekdays(item.reminderWeekdays || [1, 2, 3, 4, 5]),
    notes: item.notes || ""
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
    newRecord: {},
    editingMedicationId: "",
    reminderScheduleOptions: [
      { value: "daily", label: "每天" },
      { value: "once", label: "单次" },
      { value: "workday", label: "工作日" },
      { value: "weekly", label: "指定星期" }
    ],
    weekdayOptions: [
      { value: 1, label: "周一" },
      { value: 2, label: "周二" },
      { value: 3, label: "周三" },
      { value: 4, label: "周四" },
      { value: 5, label: "周五" },
      { value: 6, label: "周六" },
      { value: 7, label: "周日" }
    ]
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
        medications: (Array.isArray(healthInfo.medications) ? healthInfo.medications : []).map((item) => ({
          ...item,
          reminderScheduleText: buildReminderScheduleText(item)
        })),
        chartCards: viewModel.chartCards,
        pressureOverview: viewModel.pressureOverview,
        pressureTrend: viewModel.pressureTrend,
        loading: false
      });
    } catch (error) {
      console.error("load health info failed:", error);
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
        } catch (_) {
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
        } catch (_) {
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
        } catch (_) {
          wx.showToast({ title: "更新失败", icon: "none" });
        }
      }
    });
  },

  showAddHistory() {
    this.setData({
      showAddModal: true,
      addType: "history",
      editingMedicationId: "",
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
      editingMedicationId: "",
      newRecord: buildMedicationForm()
    });
  },

  editMedication(e) {
    const { id } = e.currentTarget.dataset;
    const target = this.data.medications.find((item) => item.id === id);
    if (!target) return;

    this.setData({
      showAddModal: true,
      addType: "medication",
      editingMedicationId: id,
      newRecord: buildMedicationForm(target)
    });
  },

  closeModal() {
    this.setData({
      showAddModal: false,
      addType: "",
      newRecord: {},
      editingMedicationId: ""
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

  onReminderScheduleSelect(e) {
    const { value } = e.currentTarget.dataset;
    if (!value) return;

    const nextData = {
      "newRecord.reminderScheduleType": value
    };

    if (value === "weekly" && !normalizeWeekdays(this.data.newRecord.reminderWeekdays).length) {
      nextData["newRecord.reminderWeekdays"] = [1, 2, 3, 4, 5];
    }

    if (value === "once" && !this.data.newRecord.reminderDate) {
      nextData["newRecord.reminderDate"] = getTodayDateKey();
    }

    this.setData(nextData);
  },

  onReminderDateChange(e) {
    this.setData({
      "newRecord.reminderDate": e.detail.value
    });
  },

  toggleReminderWeekday(e) {
    const { day } = e.currentTarget.dataset;
    const value = Number.parseInt(day, 10);
    if (!value) return;

    const current = normalizeWeekdays(this.data.newRecord.reminderWeekdays || []);
    const exists = current.includes(value);
    const next = exists ? current.filter((item) => item !== value) : current.concat(value);

    this.setData({
      "newRecord.reminderWeekdays": normalizeWeekdays(next)
    });
  },

  async submitNewRecord() {
    const { addType, newRecord, editingMedicationId } = this.data;
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
        const payload = {
          name: newRecord.name.trim(),
          frequency: (newRecord.frequency || "").trim(),
          dosage: (newRecord.dosage || "").trim(),
          time: (newRecord.time || "").trim(),
          reminderEnabled: !!newRecord.reminderEnabled,
          reminderTime: newRecord.reminderEnabled ? (newRecord.reminderTime || "").trim() : "",
          reminderScheduleType: newRecord.reminderEnabled ? newRecord.reminderScheduleType || "daily" : "daily",
          reminderDate: newRecord.reminderEnabled ? newRecord.reminderDate || "" : "",
          reminderWeekdays: newRecord.reminderEnabled ? normalizeWeekdays(newRecord.reminderWeekdays) : [],
          notes: (newRecord.notes || "").trim()
        };

        if (payload.reminderEnabled && payload.reminderScheduleType === "weekly" && !payload.reminderWeekdays.length) {
          wx.showToast({ title: "请选择提醒星期", icon: "none" });
          return;
        }

        if (editingMedicationId) {
          await updateMedicationAPI({
            recordId: editingMedicationId,
            ...payload
          });
        } else {
          await addMedicationAPI(payload);
        }
      }

      this.closeModal();
      await this.loadHealthInfo();
      wx.showToast({ title: editingMedicationId ? "已更新" : "添加成功", icon: "success" });
    } catch (error) {
      console.error("save health record failed:", error);
      wx.showToast({ title: "保存失败", icon: "none" });
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
        } catch (_) {
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      }
    });
  }
});
