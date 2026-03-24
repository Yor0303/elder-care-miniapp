const { getOnThisDayMemoryAPI } = require("../../api/user");

Page({
  data: {
    onThisDay: null,
    previewVisible: false,
    previewImg: ""
  },

  onShow() {
    this.loadOnThisDay();
  },

  async loadOnThisDay() {
    try {
      const data = await getOnThisDayMemoryAPI();
      if (!data) {
        this.setData({ onThisDay: null });
        return;
      }
      // 如果是云 fileID，直接赋值；如需 https 链接可改为 wx.cloud.getTempFileURL
      this.setData({ onThisDay: data });
    } catch (e) {
      this.setData({ onThisDay: null });
    }
  },

  goToFamily() {
    wx.navigateTo({
      url: '/pages/elder/family-tree'
    })
  },

  goToMemory() {
    wx.navigateTo({
      url: '/pages/elder/memory'
    })
  },

  goToHealth() {
    wx.navigateTo({
      url: '/pages/elder/health'
    })
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/elder/profile'
    })
  },

  goToFaceRecognition() {
    wx.navigateTo({
      url: '/pages/elder/face-recognition'
    })
  },

  goToMatch() {
    wx.navigateTo({
      url: '/pages/elder/match'
    })
  },

  goToUpload() {
    wx.navigateTo({
      url: '/pages/elder/upload'
    })
  },

  openPreview() {
    const img = this.data.onThisDay && this.data.onThisDay.img;
    if (!img) return;
    this.setData({ previewVisible: true, previewImg: img });
  },

  closePreview() {
    this.setData({ previewVisible: false, previewImg: "" });
  }
})
