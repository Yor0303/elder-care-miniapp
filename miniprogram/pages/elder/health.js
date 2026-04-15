const { getHealthInfoAPI, updateTodayHealthAPI } = require("../../api/user");
const { isPreviewMode, previewHealthInfo } = require("../../utils/elder-preview");

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
    return `${Number(parts[1])}\u6708${Number(parts[2])}\u65e5`;
  }

  if (raw.includes("/")) {
    const slashParts = raw.split("/");
    if (slashParts.length >= 2) {
      return `${Number(slashParts[0])}\u6708${Number(slashParts[1])}\u65e5`;
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

  let changeText = "\u8bb0\u5f55\u6ee12\u6761\u540e\u53ef\u67e5\u770b\u53d8\u5316";
  if (previous && latest) {
    if (latest.value === previous.value) {
      changeText = "\u4e0e\u4e0a\u4e00\u6761\u8bb0\u5f55\u6301\u5e73";
    } else {
      const direction = latest.value > previous.value ? "\u4e0a\u5347" : "\u4e0b\u964d";
      changeText = `\u8f83\u4e0a\u4e00\u6761${direction} ${Math.abs(latest.value - previous.value).toFixed(
        options.decimals || 0
      )}${options.unit}`;
    }
  }

  return {
    key: options.key,
    title: options.title,
    unit: options.unit,
    empty: false,
    latestValue: latest ? latest.value : options.emptyValue,
    latestLabel: latest ? latest.label : "",
    changeText,
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
  const diastolicMax = Math.max(
    ...normalizedTrend.map((item) => item.diastolic || 0),
    parsedPressure.diastolic || 0,
    1
  );

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
      diastolic: parsedPressure.diastolic,
      latestLabel: pressureTrend.length ? pressureTrend[pressureTrend.length - 1].label : ""
    },
    chartCards: [
      buildMetricChart(normalizedTrend, {
        key: "heartRate",
        title: "\u5fc3\u7387\u8d8b\u52bf",
        unit: "\u6b21/\u5206",
        emptyValue: "--",
        minScale: 60
      }),
      buildMetricChart(normalizedTrend, {
        key: "bloodSugar",
        title: "\u8840\u7cd6\u8d8b\u52bf",
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

function buildReminderMedications(medications = []) {
  return (Array.isArray(medications) ? medications : [])
    .filter((item) => item && item.activeToday && item.reminderEnabled && item.reminderTime)
    .slice()
    .sort((a, b) => String(a.reminderTime).localeCompare(String(b.reminderTime)));
}

Page({
  data: {
    previewMode: false,
    loading: false,
    errorMsg: "",
    todayHealth: {
      bloodPressure: "--/--",
      heartRate: "--",
      bloodSugar: "--"
    },
    medicalHistory: [],
    medications: [],
    reminderMedications: [],
    chartCards: [],
    pressureOverview: {
      current: "--/--",
      systolic: null,
      diastolic: null,
      latestLabel: ""
    },
    pressureTrend: []
  },

  onLoad(options = {}) {
    this.setData({ previewMode: isPreviewMode(options) });
    this.loadHealthInfo();
  },

  async loadHealthInfo() {
    this.setData({
      loading: true,
      errorMsg: ""
    });

    try {
      if (this.data.previewMode) {
        const viewModel = buildHealthViewModel(
          previewHealthInfo.todayHealth || {},
          previewHealthInfo.healthTrend || []
        );

        this.setData({
          todayHealth: previewHealthInfo.todayHealth || {},
          medicalHistory: Array.isArray(previewHealthInfo.medicalHistory) ? previewHealthInfo.medicalHistory : [],
          medications: Array.isArray(previewHealthInfo.medications) ? previewHealthInfo.medications : [],
          reminderMedications: buildReminderMedications(previewHealthInfo.medications),
          chartCards: viewModel.chartCards,
          pressureOverview: viewModel.pressureOverview,
          pressureTrend: viewModel.pressureTrend,
          loading: false
        });
        return;
      }

      const healthInfo = await getHealthInfoAPI();
      const todayHealth = healthInfo.todayHealth || {
        bloodPressure: "--/--",
        heartRate: "--",
        bloodSugar: "--"
      };
      const viewModel = buildHealthViewModel(todayHealth, healthInfo.healthTrend || []);

      this.setData({
        todayHealth,
        medicalHistory: Array.isArray(healthInfo.medicalHistory) ? healthInfo.medicalHistory : [],
        medications: Array.isArray(healthInfo.medications) ? healthInfo.medications : [],
        reminderMedications: buildReminderMedications(healthInfo.medications),
        chartCards: viewModel.chartCards,
        pressureOverview: viewModel.pressureOverview,
        pressureTrend: viewModel.pressureTrend,
        loading: false
      });
    } catch (error) {
      console.error("load health info failed:", error);
      this.setData({
        loading: false,
        errorMsg: error.message || "\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5"
      });

      wx.showToast({
        title: "\u52a0\u8f7d\u5931\u8d25",
        icon: "none"
      });
    }
  },

  async onPullDownRefresh() {
    await this.loadHealthInfo();
    wx.stopPullDownRefresh();
  },

  updateHealthData() {
    if (this.data.previewMode) {
      wx.showToast({
        title: "\u4f53\u9a8c\u6a21\u5f0f\u4ec5\u4f9b\u6d4f\u89c8\uff0c\u767b\u5f55\u540e\u53ef\u66f4\u65b0\u5065\u5eb7\u4fe1\u606f",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "\u66f4\u65b0\u8840\u538b",
      editable: true,
      placeholderText: "\u8bf7\u8f93\u5165\u8840\u538b\uff0c\u4f8b\u5982 120/80",
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
            title: "\u66f4\u65b0\u6210\u529f",
            icon: "success"
          });
        } catch (_) {
          wx.showToast({
            title: "\u66f4\u65b0\u5931\u8d25",
            icon: "none"
          });
        }
      }
    });
  },

  editHeartRate() {
    if (this.data.previewMode) {
      wx.showToast({
        title: "\u4f53\u9a8c\u6a21\u5f0f\u4ec5\u4f9b\u6d4f\u89c8\uff0c\u767b\u5f55\u540e\u53ef\u66f4\u65b0\u5065\u5eb7\u4fe1\u606f",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "\u66f4\u65b0\u5fc3\u7387",
      editable: true,
      placeholderText: "\u8bf7\u8f93\u5165\u5fc3\u7387\uff0c\u4f8b\u5982 72",
      success: async (res) => {
        if (!res.confirm || !res.content) {
          return;
        }

        try {
          await updateTodayHealthAPI({
            heartRate: parseInt(res.content, 10)
          });
          await this.loadHealthInfo();
          wx.showToast({
            title: "\u66f4\u65b0\u6210\u529f",
            icon: "success"
          });
        } catch (_) {
          wx.showToast({
            title: "\u66f4\u65b0\u5931\u8d25",
            icon: "none"
          });
        }
      }
    });
  },

  editBloodSugar() {
    if (this.data.previewMode) {
      wx.showToast({
        title: "\u4f53\u9a8c\u6a21\u5f0f\u4ec5\u4f9b\u6d4f\u89c8\uff0c\u767b\u5f55\u540e\u53ef\u66f4\u65b0\u5065\u5eb7\u4fe1\u606f",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "\u66f4\u65b0\u8840\u7cd6",
      editable: true,
      placeholderText: "\u8bf7\u8f93\u5165\u8840\u7cd6\uff0c\u4f8b\u5982 5.6",
      success: async (res) => {
        if (!res.confirm || !res.content) {
          return;
        }

        try {
          await updateTodayHealthAPI({
            bloodSugar: res.content.trim()
          });
          await this.loadHealthInfo();
          wx.showToast({
            title: "\u66f4\u65b0\u6210\u529f",
            icon: "success"
          });
        } catch (_) {
          wx.showToast({
            title: "\u66f4\u65b0\u5931\u8d25",
            icon: "none"
          });
        }
      }
    });
  }
});
