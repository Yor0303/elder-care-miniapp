const { addElderUploadAPI } = require("../../api/user");

Page({
  data: {
    mode: "image",
    fileUrl: "",
    text: "",
    date: "",
    submitting: false
  },

  switchToImage() {
    this.setData({ mode: "image" });
  },

  switchToText() {
    this.setData({ mode: "text" });
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        this.setData({ fileUrl: res.tempFilePaths[0] });
      }
    });
  },

  onTextInput(e) {
    this.setData({ text: e.detail.value });
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;

    const { mode, fileUrl, text, date } = this.data;

    if (mode === "image" && !fileUrl) {
      wx.showToast({ title: "请先选择照片", icon: "none" });
      return;
    }
    if (mode === "text" && !text.trim()) {
      wx.showToast({ title: "请填写文字内容", icon: "none" });
      return;
    }

    this.setData({ submitting: true });

    try {
      let payload = {};
      if (mode === "image") {
        const extMatch = fileUrl.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0] : ".jpg";
        const cloudPath = `elder-uploads/${Date.now()}-${Math.random().toString(36).slice(2, 11)}${ext}`;

        wx.showLoading({ title: "上传中..." });
        const upRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: fileUrl
        });
        wx.hideLoading();

        payload = {
          type: "image",
          fileID: upRes.fileID
        };
      } else {
        payload = {
          type: "text",
          content: text.trim()
        };
      }

      if (date) {
        // 直接透传本地选择的 YYYY-MM-DD，并同时提供 eventMonthDay，避免任何时区导致的偏移
        payload.eventDate = `${date}T00:00:00+08:00`;
        payload.eventMonthDay = date.slice(5);
      }

      wx.showLoading({ title: "保存中..." });
      await addElderUploadAPI(payload);
      wx.hideLoading();

      wx.showToast({ title: "保存成功", icon: "success" });
      this.setData({
        fileUrl: "",
        text: "",
        date: "",
        submitting: false
      });
      wx.navigateBack({ delta: 1 });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || "保存失败", icon: "none" });
      this.setData({ submitting: false });
    }
  }
});
