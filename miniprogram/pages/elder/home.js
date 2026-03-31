const {
  getOnThisDayMemoryAPI,
  getVoiceMessagesAPI,
  markVoiceMessagesReadAPI,
  getHealthInfoAPI,
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

function buildMedicationReminders(medications) {
  if (!Array.isArray(medications)) return [];

  return medications
    .filter((item) => item && item.name)
    .map((item) => ({
      id: item.id || `${item.name}-${item.time || ""}`,
      name: item.name || "",
      frequency: item.frequency || "",
      time: item.time || "",
      dosage: item.dosage || "",
      notes: item.notes || ""
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
    bindQrLoading: false
  },

  onLoad() {
    this.innerAudioContext = wx.createInnerAudioContext();
    this.promptAudioContext = wx.createInnerAudioContext();
    this.speechPlugin = getSpeechPlugin();
    this.lastPromptKey = "";
    this.initAudioPlayer();
    this.initPromptAudioPlayer();
  },

  onShow() {
    this.loadBoardData();
    this.loadPendingCount();
    this.loadElderProfile();
    if (this.data.pageTab === "mine") {
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
      const voiceMessages = await this.attachAudioUrls(list);

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
      const healthInfo = await getHealthInfoAPI();
      this.setData({
        medicationReminders: buildMedicationReminders(healthInfo && healthInfo.medications)
      });
    } catch (_) {
      this.setData({ medicationReminders: [] });
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

    if (tab === "mine" && !this.data.bindQrCodeFileID) {
      this.loadBindingQRCode();
    }
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
      title: "邀请家人加入忆站，一起守护回忆与健康",
      path: elderId ? `/pages/login/login?inviteElderId=${elderId}` : "/pages/login/login"
    };
  }
});
