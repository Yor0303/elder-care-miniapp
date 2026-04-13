const {
  getOnThisDayMemoryAPI,
  getVoiceMessagesAPI,
  markVoiceMessagesReadAPI,
  getHealthInfoAPI,
  getTodayCompletedTasksAPI,
  completeTodayTaskAPI,
  getBindingRequestsAPI,
  getElderInfoAPI,
  getBindingQRCodeAPI
} = require("../../api/user");

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

function getSpeechPlugin() {
  try {
    return requirePlugin("WechatSI");
  } catch (_) {
    return null;
  }
}

function getWeekdayNumber(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
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

function isReminderActiveToday(item) {
  if (!item || !item.reminderEnabled || !item.reminderTime) {
    return false;
  }

  const today = new Date();
  const dateKey = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
  const weekday = getWeekdayNumber(today);
  const type = item.reminderScheduleType || "daily";

  if (type === "once") {
    return !!item.reminderDate && item.reminderDate === dateKey;
  }

  if (type === "workday") {
    return weekday >= 1 && weekday <= 5;
  }

  if (type === "weekly") {
    return normalizeWeekdays(item.reminderWeekdays).includes(weekday);
  }

  return true;
}

function buildMedicationReminders(medications) {
  if (!Array.isArray(medications)) return [];

  return medications
    .filter((item) => item && item.name && isReminderActiveToday(item))
    .map((item) => ({
      id: item.id || `${item.name}-${item.time || ""}`,
      taskType: "medication",
      name: item.name || "",
      frequency: item.frequency || "",
      time: item.reminderTime || item.time || "",
      dosage: item.dosage || "",
      notes: item.notes || ""
    }));
}

function buildMessageReminders(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((item) => item && item.messageType === "reminder" && isReminderActiveToday(item))
    .map((item) => ({
      id: item.id || "",
      taskType: "messageReminder",
      name: item.note || "待办提醒",
      frequency: item.senderName ? `来自 ${item.senderName}` : "",
      time: item.reminderTime || "",
      dosage: "",
      notes: ""
    }));
}

Page({
  data: {
    pageTab: "home",
    boardTab: "messages",
    onThisDay: null,
    medicationReminders: [],
    pendingCount: 0,
    voiceMessages: [],
    unreadMessageCount: 0,
    previewVisible: false,
    previewImg: "",
    playingMessageId: "",
    elderProfile: null,
    bindQrCodeFileID: "",
    bindQrLoading: false,
    previewMode: false,
    previewFrom: "",
    completingReminderId: "",
    copy: {
      previewTitle: "家属端预览",
      previewDesc: "当前为老人端首页预览，可返回家属端继续编辑内容。",
      backToFamily: "返回家属端",
      todayCompanion: "每日陪伴",
      boardMessagesDesc: "看看家人给您留下的最新留言。",
      boardRemindersDesc: "今天需要留意的提醒都在这里。",
      unreadSuffix: "条未读",
      readDone: "已读完",
      todoSuffix: "项待办",
      todayDone: "今日完成",
      familyMessages: "家人留言",
      todayReminders: "今日提醒",
      recallPrompt: "今日回忆",
      recallDesc: "点开看看家人给您准备的回忆内容。",
      justNow: "刚刚",
      stop: "停止",
      play: "播放",
      textTag: "文字",
      noMessages: "暂时还没有新的家人留言。",
      noReminders: "今天暂无提醒，放松一下吧。",
      memoryAlbum: "回忆相册",
      familyTree: "家庭树",
      healthManage: "健康管理",
      myProfile: "我的资料",
      bindingMessages: "绑定消息",
      lifeGuide: "生活指南",
      appName: "易忆站",
      defaultElderName: "长者",
      mineDesc: "在这里查看个人资料和绑定二维码。",
      previewQrTitle: "预览模式",
      previewQrDesc: "预览时不展示绑定二维码和绑定消息操作。",
      qrPanelTitle: "绑定二维码",
      qrPanelDesc: "让家人扫一扫，就能和您建立连接。",
      qrLoading: "二维码生成中",
      qrPlaceholder: "点击刷新生成绑定二维码",
      refreshQr: "\u5237\u65b0\u4e8c\u7ef4\u7801",
      generateQr: "\u751f\u6210\u4e8c\u7ef4\u7801",
      viewBindingMessages: "\u67e5\u770b\u7ed1\u5b9a\u6d88\u606f",
      personalProfile: "个人资料",
      memoryMatch: "回忆配对",
      bindingRequest: "绑定申请",
      home: "首页",
      faceRecognition: "人脸识别",
      mine: "我的"
    }
  },

  onLoad(options = {}) {
    this.setData({
      previewMode: options.preview === "1",
      previewFrom: options.from || ""
    });
    this.innerAudioContext = wx.createInnerAudioContext();
    this.promptAudioContext = wx.createInnerAudioContext();
    this.speechPlugin = getSpeechPlugin();
    this.lastPromptKey = "";
    this.initAudioPlayer();
    this.initPromptAudioPlayer();
  },

  onShow() {
    this.loadBoardData();
    if (this.data.previewMode) {
      this.setData({ pendingCount: 0 });
    } else {
      this.loadPendingCount();
    }
    this.loadElderProfile();
    if (this.data.pageTab === "mine" && !this.data.previewMode) {
      this.loadBindingQRCode();
    }
  },

  onHide() {
    this.stopAudio();
    this.stopPromptAudio();
  },

  onUnload() {
    this.stopAudio();
    this.stopPromptAudio();
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
      this.innerAudioContext = null;
    }
    if (this.promptAudioContext) {
      this.promptAudioContext.destroy();
      this.promptAudioContext = null;
    }
  },

  initAudioPlayer() {
    if (!this.innerAudioContext) return;

    this.innerAudioContext.onEnded(() => {
      this.setData({ playingMessageId: "" });
    });

    this.innerAudioContext.onStop(() => {
      this.setData({ playingMessageId: "" });
    });

    this.innerAudioContext.onError(() => {
      this.setData({ playingMessageId: "" });
      wx.showToast({ title: "语音播放失败", icon: "none" });
    });
  },

  initPromptAudioPlayer() {
    if (!this.promptAudioContext) return;
    this.promptAudioContext.onError(() => {
      this.fallbackPromptHint();
    });
  },

  async loadBoardData() {
    await Promise.all([this.loadOnThisDay(), this.loadVoiceMessages(), this.loadMedicationReminders()]);
  },

  async loadPendingCount() {
    try {
      const requests = await getBindingRequestsAPI();
      const list = Array.isArray(requests) ? requests : [];
      this.setData({
        pendingCount: list.filter((item) => item && item.status === "pending").length
      });
    } catch (_) {
      this.setData({ pendingCount: 0 });
    }
  },

  async loadElderProfile() {
    try {
      const elder = await getElderInfoAPI();
      this.setData({
        elderProfile: elder || null
      });
    } catch (_) {
      this.setData({ elderProfile: null });
    }
  },

  async loadBindingQRCode(forceRefresh = false) {
    if (this.data.bindQrLoading) return;

    try {
      this.setData({ bindQrLoading: true });
      const result = await getBindingQRCodeAPI(!!forceRefresh);
      this.setData({
        bindQrCodeFileID: (result && result.fileID) || "",
        bindQrLoading: false
      });
    } catch (error) {
      this.setData({ bindQrLoading: false });
      wx.showToast({
        title: (error && (error.message || error.msg)) || "二维码生成失败",
        icon: "none"
      });
    }
  },

  async loadOnThisDay() {
    try {
      const data = await getOnThisDayMemoryAPI();
      this.setData({ onThisDay: data || null });
    } catch (_) {
      this.setData({ onThisDay: null });
    }
  },

  async loadVoiceMessages() {
    try {
      const res = await getVoiceMessagesAPI();
      const list = Array.isArray(res && res.list) ? res.list : [];
      const unreadMessageCount = Number((res && res.unreadCount) || 0);
      const voiceMessages = await this.attachAudioUrls(
        list.filter((item) => item && item.messageType !== "reminder")
      );

      this.setData({
        unreadMessageCount,
        voiceMessages: voiceMessages.map((item) => ({
          ...item,
          hasAudio: !!item.fileID,
          note: item.note || "",
          displayTime: formatDateTime(item.createdAt),
          durationText: item.fileID ? formatDuration(item.duration) : ""
        }))
      });

      this.maybeAnnounceNewMessages(voiceMessages, unreadMessageCount);
      if (this.data.boardTab === "messages" && unreadMessageCount > 0) {
        this.markMessagesReadSilently();
      }
    } catch (_) {
      this.setData({
        unreadMessageCount: 0,
        voiceMessages: []
      });
    }
  },

  async loadMedicationReminders() {
    try {
      const [healthInfo, completed, messageRes] = await Promise.all([
        getHealthInfoAPI(),
        getTodayCompletedTasksAPI(),
        getVoiceMessagesAPI()
      ]);
      const completedKeys = new Set(
        ((completed && completed.items) || [])
          .filter((item) => item && item.taskType && item.taskId)
          .map((item) => `${item.taskType}:${item.taskId}`)
      );
      const medicationItems = buildMedicationReminders(healthInfo && healthInfo.medications);
      const messageItems = buildMessageReminders(messageRes && messageRes.list);

      this.setData({
        medicationReminders: medicationItems
          .concat(messageItems)
          .filter((item) => !completedKeys.has(`${item.taskType}:${item.id}`))
          .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")))
      });
    } catch (_) {
      this.setData({ medicationReminders: [] });
    }
  },

  async completeReminder(e) {
    const { id, taskType } = e.currentTarget.dataset;
    if (!id || this.data.completingReminderId) return;

    if (this.data.previewMode) {
      wx.showToast({ title: "\u9884\u89c8\u6a21\u5f0f\u4e0b\u4e0d\u53ef\u7528", icon: "none" });
      return;
    }

    this.setData({ completingReminderId: id });

    try {
      await completeTodayTaskAPI({
        taskType: taskType || "medication",
        taskId: id
      });

      this.setData({
        medicationReminders: this.data.medicationReminders.filter((item) => item.id !== id),
        completingReminderId: ""
      });
      wx.showToast({ title: "\u5df2\u5b8c\u6210", icon: "success" });
    } catch (error) {
      this.setData({ completingReminderId: "" });
      wx.showToast({
        title: (error && (error.message || error.msg)) || "\u64cd\u4f5c\u5931\u8d25",
        icon: "none"
      });
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

  async switchBoardTab(e) {
    const { tab } = e.currentTarget.dataset;
    if (!tab || tab === this.data.boardTab) return;

    this.setData({ boardTab: tab });

    if (tab === "messages" && this.data.unreadMessageCount > 0) {
      await this.markMessagesReadSilently();
    }
  },

  switchPageTab(e) {
    const { tab } = e.currentTarget.dataset;
    if (!tab || tab === this.data.pageTab) return;
    this.setData({ pageTab: tab });

    if (tab === "mine" && !this.data.previewMode && !this.data.bindQrCodeFileID) {
      this.loadBindingQRCode();
    }
  },

  exitPreview() {
    if (!this.data.previewMode) return;
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: "/pages/family/home" });
      }
    });
  },

  async markMessagesReadSilently() {
    try {
      await markVoiceMessagesReadAPI();
    } catch (_) {
      return;
    }

    this.setData({
      unreadMessageCount: 0,
      voiceMessages: this.data.voiceMessages.map((item) => ({
        ...item,
        isReadByElder: true
      }))
    });
    this.lastPromptKey = "";
  },

  playVoiceMessage(e) {
    const { id } = e.currentTarget.dataset;
    const target = this.data.voiceMessages.find((item) => item.id === id);

    if (!target || !target.audioUrl) {
      wx.showToast({ title: "语音暂时无法播放", icon: "none" });
      return;
    }

    if (this.data.playingMessageId === id) {
      this.stopAudio();
      return;
    }

    this.innerAudioContext.src = target.audioUrl;
    this.innerAudioContext.play();
    this.setData({ playingMessageId: id });
  },

  stopAudio() {
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
    }
  },

  stopPromptAudio() {
    if (this.promptAudioContext) {
      this.promptAudioContext.stop();
    }
  },

  maybeAnnounceNewMessages(list, unreadCount) {
    if (!unreadCount) {
      this.lastPromptKey = "";
      return;
    }

    const unreadList = (list || []).filter((item) => !item.isReadByElder);
    if (!unreadList.length) {
      this.lastPromptKey = "";
      return;
    }

    const latestUnread = unreadList[0];
    const promptKey = `${latestUnread.id || ""}:${unreadCount}`;
    if (promptKey === this.lastPromptKey) {
      return;
    }

    this.lastPromptKey = promptKey;
    this.playNewMessagePrompt();
  },

  async playNewMessagePrompt() {
    const filePath = await this.synthesizePromptAudio("您有新的家人留言");
    if (!filePath || !this.promptAudioContext) {
      this.fallbackPromptHint();
      return;
    }

    this.promptAudioContext.stop();
    this.promptAudioContext.src = filePath;
    this.promptAudioContext.play();
  },

  synthesizePromptAudio(content) {
    if (!this.speechPlugin || typeof this.speechPlugin.textToSpeech !== "function") {
      return Promise.resolve("");
    }

    return new Promise((resolve) => {
      this.speechPlugin.textToSpeech({
        lang: "zh_CN",
        tts: true,
        content,
        success: (res) => {
          resolve((res && (res.filename || res.filePath)) || "");
        },
        fail: () => resolve("")
      });
    });
  },

  fallbackPromptHint() {
    wx.vibrateShort({ type: "light", fail: () => {} });
    wx.showToast({
      title: "您有新的家人留言",
      icon: "none"
    });
  },

  refreshBindingQRCode() {
    if (this.data.previewMode) {
      wx.showToast({ title: "预览模式下不可用", icon: "none" });
      return;
    }
    this.loadBindingQRCode(true);
  },

  goToFamily() {
    wx.navigateTo({ url: "/pages/elder/family-tree" });
  },

  goToMemory() {
    wx.navigateTo({ url: "/pages/elder/memory" });
  },

  goToHealth() {
    wx.navigateTo({ url: "/pages/elder/health" });
  },

  goToProfile() {
    wx.navigateTo({ url: "/pages/elder/profile" });
  },

  goToMatch() {
    wx.navigateTo({ url: "/pages/elder/match" });
  },

  goToLifeGuides() {
    wx.navigateTo({ url: "/pages/elder/life-guides" });
  },

  goToBindingRequests() {
    if (this.data.previewMode) {
      wx.showToast({ title: "预览模式下不可用", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/elder/binding-requests" });
  },

  goToFaceRecognition() {
    wx.navigateTo({ url: "/pages/elder/face-recognition" });
  },

  openPreview() {
    const img = this.data.onThisDay && this.data.onThisDay.img;
    if (!img) return;
    this.setData({ previewVisible: true, previewImg: img });
  },

  closePreview() {
    this.setData({ previewVisible: false, previewImg: "" });
  },

  onShareAppMessage() {
    let elderId = "";
    try {
      elderId = wx.getStorageSync("userId") || "";
    } catch (_) {
      elderId = "";
    }

    return {
      title: "\u9080\u8bf7\u5bb6\u4eba\u52a0\u5165\u6613\u5fc6\u7ad9\uff0c\u4e00\u8d77\u5b88\u62a4\u56de\u5fc6\u4e0e\u5065\u5eb7",
      path: elderId ? `/pages/login/login?inviteElderId=${elderId}` : "/pages/login/login"
    };
  }
});
