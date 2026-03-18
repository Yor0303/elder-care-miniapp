Page({
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
  }
})
