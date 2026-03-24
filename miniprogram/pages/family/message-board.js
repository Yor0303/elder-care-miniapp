const { addVoiceMessageAPI, getVoiceMessagesAPI } = require("../../api/user");

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

Page({
  data: {
    recording: false,
    recordSeconds: 0,
    tempVoicePath: "",
    tempVoiceDuration: 0,
    messageNote: "",
    sending: false,
    loading: false,
    messages: [],
    playingMessageId: ""
  },

  onLoad() {
    this.recorderManager = wx.getRecorderManager();
    this.innerAudioContext = wx.createInnerAudioContext();
    this.recordTimer = null;
    this.initRecorder();
    this.initAudioPlayer();
  },

  onShow() {
    this.loadMessages();
  },

  onHide() {
    this.stopAudio();
    this.clearRecordTimer();
  },

  onUnload() {
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
      this.setData({
        recording: true,
        recordSeconds: 0,
        tempVoicePath: "",
        tempVoiceDuration: 0
      });
      this.clearRecordTimer();
      this.recordTimer = setInterval(() => {
        this.setData({
          recordSeconds: this.data.recordSeconds + 1
        });
      }, 1000);
    });

    this.recorderManager.onStop((res) => {
      this.clearRecordTimer();
      const duration = Math.max(1, Math.round((res.duration || 0) / 1000));
      this.setData({
        recording: false,
        tempVoicePath: res.tempFilePath || "",
        tempVoiceDuration: duration
      });
    });

    this.recorderManager.onError(() => {
      this.clearRecordTimer();
      this.setData({ recording: false });
      wx.showToast({ title: "录音失败", icon: "none" });
    });
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

  clearRecordTimer() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
  },

  async loadMessages() {
    this.setData({ loading: true });

    try {
      const res = await getVoiceMessagesAPI();
      const list = Array.isArray(res && res.list) ? res.list : [];
      const messages = await this.attachAudioUrls(list);

      this.setData({
        loading: false,
        messages: messages.map((item) => ({
          ...item,
          hasAudio: !!item.fileID,
          note: item.note || "",
          displayTime: formatDateTime(item.createdAt),
          durationText: item.fileID ? formatDuration(item.duration) : ""
        }))
      });
    } catch (error) {
      this.setData({ loading: false, messages: [] });
      wx.showToast({ title: "留言加载失败", icon: "none" });
    }
  },

  attachAudioUrls(list) {
    if (!Array.isArray(list) || !list.length) {
      return Promise.resolve([]);
    }

    const fileList = list
      .map((item) => item.fileID)
      .filter(Boolean);

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
    if (this.data.recording) return;

    try {
      const setting = await getSettingAsync();
      const hasAuth = !!(setting.authSetting && setting.authSetting["scope.record"]);

      if (!hasAuth) {
        await authorizeAsync("scope.record");
      }

      this.recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: "mp3"
      });
    } catch (error) {
      wx.showModal({
        title: "需要录音权限",
        content: "请先开启录音权限，才能给老人发送语音留言。",
        showCancel: false
      });
    }
  },

  stopRecord() {
    if (!this.data.recording) return;
    this.recorderManager.stop();
  },

  clearDraft() {
    this.setData({
      tempVoicePath: "",
      tempVoiceDuration: 0,
      recordSeconds: 0
    });
  },

  onNoteInput(e) {
    this.setData({ messageNote: e.detail.value });
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
    const note = (this.data.messageNote || "").trim();
    if (this.data.sending) {
      return;
    }

    if (!this.data.tempVoicePath && !note) {
      wx.showToast({ title: "请先输入文字或录制语音", icon: "none" });
      return;
    }

    this.setData({ sending: true });

    try {
      wx.showLoading({ title: "发送中..." });
      let fileID = "";
      if (this.data.tempVoicePath) {
        fileID = await this.uploadToCloud(this.data.tempVoicePath);
      }
      await addVoiceMessageAPI({
        fileID,
        duration: this.data.tempVoiceDuration,
        note
      });
      wx.hideLoading();

      this.setData({
        sending: false,
        tempVoicePath: "",
        tempVoiceDuration: 0,
        recordSeconds: 0,
        messageNote: ""
      });

      wx.showToast({ title: "留言已发送", icon: "success" });
      this.loadMessages();
    } catch (error) {
      wx.hideLoading();
      this.setData({ sending: false });
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
    this.setData({ playingMessageId: id });
  },

  stopAudio() {
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
    }
  }
});
