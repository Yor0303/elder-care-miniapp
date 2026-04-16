const { addVoiceMessageAPI, getVoiceMessagesAPI } = require("../../api/user");
const {
  isPreviewMode,
  previewMessageBoardMessages,
  promptPreviewLogin
} = require("../../utils/family-preview");

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minute = `${Math.floor(total / 60)}`.padStart(2, "0");
  const second = `${total % 60}`.padStart(2, "0");
  return `${minute}:${second}`;
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

function buildScheduleText(item = {}) {
  if (item.messageType !== "reminder") return "";
  const time = item.reminderTime || "";
  const type = item.reminderScheduleType || "daily";

  if (type === "once") {
    return `${time} 单次${item.reminderDate ? ` · ${item.reminderDate}` : ""}`;
  }

  if (type === "workday") {
    return `${time} 工作日`;
  }

  if (type === "weekly") {
    const days = normalizeWeekdays(item.reminderWeekdays)
      .map((day) => `周${getWeekdayLabel(day)}`)
      .join("、");
    return `${time} ${days || "按星期"}`;
  }

  return `${time} 每天`;
}

function getSettingAsync() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: resolve,
      fail: reject
    });
  });
}

function authorizeAsync(scope) {
  return new Promise((resolve, reject) => {
    wx.authorize({
      scope,
      success: resolve,
      fail: reject
    });
  });
}

function showModalAsync(options) {
  return new Promise((resolve) => {
    wx.showModal({
      ...options,
      success: resolve,
      fail: () => resolve({ confirm: false, cancel: true })
    });
  });
}

function openSettingAsync() {
  return new Promise((resolve, reject) => {
    wx.openSetting({
      success: resolve,
      fail: reject
    });
  });
}

function getRecorderErrorMessage(error = {}) {
  const raw = String(
    (error && (error.errMsg || error.message)) || ""
  ).trim();

  if (!raw) {
    return "录音失败，请稍后重试";
  }

  if (raw.includes("auth deny") || raw.includes("authorize:no response")) {
    return "未开启录音权限，请先授权麦克风";
  }

  if (raw.includes("not supported") || raw.includes("not support")) {
    return "当前环境不支持录音，请使用真机调试";
  }

  if (raw.includes("NotReadableError")) {
    return "麦克风当前不可读，通常是录音设备被其他程序占用、系统没有可用输入设备，或开发者工具录音异常。请先关闭占用麦克风的软件后重试，优先使用真机调试。";
  }

  if (raw.includes("interrupted")) {
    return "录音被系统中断，请重试";
  }

  if (raw.includes("start")) {
    return `录音启动失败：${raw}`;
  }

  return `录音失败：${raw}`;
}

Page({
  setPageActive(active) {
    this._pageActive = !!active;
  },

  safeSetData(data, callback) {
    if (!this._pageActive) {
      return;
    }
    this.setData(data, callback);
  },

  data: {
    previewMode: false,
    recording: false,
    stoppingRecord: false,
    recordSeconds: 0,
    tempVoicePath: "",
    tempVoiceDuration: 0,
    messageNote: "",
    sending: false,
    loading: false,
    messages: [],
    playingMessageId: "",
    reminderMode: false,
    reminderTime: "09:00",
    reminderScheduleType: "daily",
    reminderDate: getTodayDateKey(),
    reminderWeekdays: [1, 2, 3, 4, 5],
    reminderScheduleOptions: [
      { value: "daily", label: "每天" },
      { value: "once", label: "单次" },
      { value: "workday", label: "工作日" },
      { value: "weekly", label: "指定星期" }
    ],
    reminderScheduleActionItems: [],
    showReminderScheduleSheet: false,
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

  onLoad(options = {}) {
    this.setPageActive(true);
    this.safeSetData({
      previewMode: isPreviewMode(options)
    });
    this.recorderManager = wx.getRecorderManager();
    this.innerAudioContext = wx.createInnerAudioContext();
    this.recordTimer = null;
    this.safeSetData({
      reminderScheduleActionItems: this.data.reminderScheduleOptions.map((item) => ({
        text: item.label,
        value: item.value
      }))
    });
    this.initRecorder();
    this.initAudioPlayer();
  },

  onShow() {
    this.setPageActive(true);
    this.loadMessages();
  },

  onHide() {
    this.setPageActive(false);
    this.stopAudio();
    this.clearRecordTimer();
  },

  onUnload() {
    this.setPageActive(false);
    this.stopAudio();
    this.clearRecordTimer();
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
      this.innerAudioContext = null;
    }
  },

  initRecorder() {
    if (!this.recorderManager) return;

    this.recorderManager.onStart(() => {
      this.safeSetData({
        recording: true,
        stoppingRecord: false,
        recordSeconds: 0,
        tempVoicePath: "",
        tempVoiceDuration: 0
      });
      this.clearRecordTimer();
      this.recordTimer = setInterval(() => {
        if (!this._pageActive) {
          this.clearRecordTimer();
          return;
        }
        this.safeSetData({
          recordSeconds: this.data.recordSeconds + 1
        });
      }, 1000);
    });

    this.recorderManager.onStop((res) => {
      this.clearRecordTimer();
      const duration = Math.max(1, Math.round((res.duration || 0) / 1000));
      this.safeSetData({
        recording: false,
        stoppingRecord: false,
        tempVoicePath: res.tempFilePath || "",
        tempVoiceDuration: duration
      });
    });

    this.recorderManager.onError((error) => {
      this.clearRecordTimer();
      this.safeSetData({ recording: false, stoppingRecord: false });
      console.error("recorderManager error:", error);
      wx.showModal({
        title: "录音失败",
        content: getRecorderErrorMessage(error),
        showCancel: false,
        confirmText: "我知道了"
      });
    });
  },

  initAudioPlayer() {
    if (!this.innerAudioContext) return;

    this.innerAudioContext.onEnded(() => {
      this.safeSetData({ playingMessageId: "" });
    });

    this.innerAudioContext.onStop(() => {
      this.safeSetData({ playingMessageId: "" });
    });

    this.innerAudioContext.onError(() => {
      this.safeSetData({ playingMessageId: "" });
      wx.showToast({ title: "语音播放失败", icon: "none" });
    });
  },

  clearRecordTimer() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
  },

  async loadMessages() {
    this.safeSetData({ loading: true });

    try {
      if (this.data.previewMode) {
        this.safeSetData({
          loading: false,
          messages: previewMessageBoardMessages.map((item) => ({
            ...item,
            note: item.note || "",
            displayTime: formatDateTime(item.createdAt),
            durationText: "",
            typeLabel: item.messageType === "reminder" ? "提醒" : "文字",
            scheduleText: buildScheduleText(item)
          }))
        });
        return;
      }

      const res = await getVoiceMessagesAPI();
      const list = Array.isArray(res && res.list) ? res.list : [];
      const messages = await this.attachAudioUrls(list);

      this.safeSetData({
        loading: false,
        messages: messages.map((item) => ({
          ...item,
          hasAudio: !!item.fileID,
          note: item.note || "",
          displayTime: formatDateTime(item.createdAt),
          durationText: item.fileID ? formatDuration(item.duration) : "",
          typeLabel: item.messageType === "reminder" ? "提醒" : item.hasAudio ? "语音" : "文字",
          scheduleText: buildScheduleText(item)
        }))
      });
    } catch (error) {
      this.safeSetData({ loading: false, messages: [] });
      wx.showToast({ title: "留言加载失败", icon: "none" });
    }
  },

  attachAudioUrls(list) {
    if (!Array.isArray(list) || !list.length) {
      return Promise.resolve([]);
    }

    const fileList = list.map((item) => item.fileID).filter(Boolean);
    if (!fileList.length) {
      return Promise.resolve(list);
    }

    return wx.cloud.getTempFileURL({ fileList }).then((res) => {
      const urlMap = {};
      (res.fileList || []).forEach((item) => {
        if (item.fileID && item.tempFileURL) {
          urlMap[item.fileID] = item.tempFileURL;
        }
      });

      return list.map((item) => ({
        ...item,
        audioUrl: urlMap[item.fileID] || ""
      }));
    });
  },

  async startRecord() {
    if (this.data.previewMode) {
      promptPreviewLogin("发送语音留言");
      return;
    }
    if (this.data.recording) return;

    try {
      const setting = await getSettingAsync();
      const hasAuth = !!(setting.authSetting && setting.authSetting["scope.record"]);

      if (!hasAuth) {
        try {
          await authorizeAsync("scope.record");
        } catch (_) {
          const modalRes = await showModalAsync({
            title: "需要录音权限",
            content: "录语音留言需要麦克风权限，请在设置中开启录音权限。",
            confirmText: "去设置",
            cancelText: "取消"
          });

          if (!modalRes.confirm) {
            return;
          }

          const settingRes = await openSettingAsync();
          const enabled = !!(settingRes.authSetting && settingRes.authSetting["scope.record"]);
          if (!enabled) {
            wx.showToast({ title: "未开启录音权限", icon: "none" });
            return;
          }
        }
      }

      this.recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: "aac"
      });
    } catch (error) {
      console.error("start record failed:", error);
      wx.showModal({
        title: "需要录音权限",
        content: getRecorderErrorMessage(error) || "请先开启录音权限，才能给老人发送语音留言。",
        confirmText: "去设置",
        success: (res) => {
          if (res.confirm) {
            wx.openSetting();
          }
        }
      });
    }
  },

  stopRecord() {
    if (!this.data.recording) return;
    this.safeSetData({
      recording: false,
      stoppingRecord: true
    });
    this.recorderManager.stop();
  },

  clearDraft() {
    this.safeSetData({
      tempVoicePath: "",
      tempVoiceDuration: 0,
      recordSeconds: 0,
      stoppingRecord: false
    });
  },

  onNoteInput(e) {
    this.safeSetData({ messageNote: e.detail.value });
  },

  setComposerMode(e) {
    const { mode } = e.currentTarget.dataset;
    if (!mode) return;

    this.safeSetData({
      reminderMode: mode === "reminder"
    });
  },

  toggleReminderMode() {
    this.safeSetData({
      reminderMode: !this.data.reminderMode
    });
  },

  onReminderTimeInput(e) {
    this.safeSetData({ reminderTime: e.detail.value });
  },

  onReminderTimeChange(e) {
    this.safeSetData({ reminderTime: e.detail.value });
  },

  openReminderScheduleSheet() {
    this.safeSetData({ showReminderScheduleSheet: true });
  },

  closeReminderScheduleSheet() {
    this.safeSetData({ showReminderScheduleSheet: false });
  },

  onReminderScheduleSelect(e) {
    const value = (e.detail && e.detail.value) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.value);
    if (!value) return;

    const nextData = {
      reminderScheduleType: value,
      showReminderScheduleSheet: false
    };

    if (value === "weekly" && !normalizeWeekdays(this.data.reminderWeekdays).length) {
      nextData.reminderWeekdays = [1, 2, 3, 4, 5];
    }

    if (value === "once" && !this.data.reminderDate) {
      nextData.reminderDate = getTodayDateKey();
    }

    this.safeSetData(nextData);
  },

  onReminderDateChange(e) {
    this.safeSetData({
      reminderDate: e.detail.value
    });
  },

  toggleReminderWeekday(e) {
    const { day } = e.currentTarget.dataset;
    const value = Number.parseInt(day, 10);
    if (!value) return;

    const current = normalizeWeekdays(this.data.reminderWeekdays);
    const exists = current.includes(value);
    const next = exists ? current.filter((item) => item !== value) : current.concat(value);
    this.safeSetData({
      reminderWeekdays: normalizeWeekdays(next)
    });
  },

  uploadToCloud(tempFilePath) {
    return new Promise((resolve, reject) => {
      const extMatch = tempFilePath.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : ".mp3";
      const cloudPath = `voice-messages/${Date.now()}-${Math.random().toString(36).slice(2, 11)}${ext}`;

      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  async sendVoiceMessage() {
    if (this.data.previewMode) {
      promptPreviewLogin(this.data.reminderMode ? "发送提醒事项" : "发送留言");
      return;
    }
    const note = (this.data.messageNote || "").trim();
    if (this.data.sending) return;

    if (!this.data.tempVoicePath && !note) {
      wx.showToast({ title: "请输入内容或录制语音", icon: "none" });
      return;
    }

    if (this.data.reminderMode && !note) {
      wx.showToast({ title: "提醒内容不能为空", icon: "none" });
      return;
    }

    if (
      this.data.reminderMode &&
      this.data.reminderScheduleType === "weekly" &&
      !normalizeWeekdays(this.data.reminderWeekdays).length
    ) {
      wx.showToast({ title: "请选择提醒星期", icon: "none" });
      return;
    }

    this.safeSetData({ sending: true });

    try {
      wx.showLoading({ title: "发送中..." });
      let fileID = "";
      if (this.data.tempVoicePath) {
        fileID = await this.uploadToCloud(this.data.tempVoicePath);
      }

      await addVoiceMessageAPI({
        fileID,
        duration: this.data.tempVoiceDuration,
        note,
        messageType: this.data.reminderMode ? "reminder" : "message",
        reminderTime: this.data.reminderMode ? this.data.reminderTime.trim() : "",
        reminderScheduleType: this.data.reminderMode ? this.data.reminderScheduleType : "daily",
        reminderDate: this.data.reminderMode ? this.data.reminderDate : "",
        reminderWeekdays: this.data.reminderMode ? normalizeWeekdays(this.data.reminderWeekdays) : []
      });

      wx.hideLoading();
      this.safeSetData({
        sending: false,
        tempVoicePath: "",
        tempVoiceDuration: 0,
        recordSeconds: 0,
        stoppingRecord: false,
        messageNote: "",
        reminderMode: false,
        reminderTime: "09:00",
        reminderScheduleType: "daily",
        reminderDate: getTodayDateKey(),
        reminderWeekdays: [1, 2, 3, 4, 5]
      });

      wx.showToast({ title: "已发送", icon: "success" });
      this.loadMessages();
    } catch (error) {
      wx.hideLoading();
      this.safeSetData({ sending: false });
      wx.showToast({ title: error.message || "发送失败", icon: "none" });
    }
  },

  playMessage(e) {
    const { id } = e.currentTarget.dataset;
    const target = this.data.messages.find((item) => item.id === id);

    if (!target || !target.audioUrl) {
      wx.showToast({ title: "语音地址无效", icon: "none" });
      return;
    }

    if (this.data.playingMessageId === id) {
      this.stopAudio();
      return;
    }

    this.innerAudioContext.src = target.audioUrl;
    this.innerAudioContext.play();
    this.safeSetData({ playingMessageId: id });
  },

  stopAudio() {
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
    }
  }
});
