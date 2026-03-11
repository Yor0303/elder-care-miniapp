Page({
  enterElder() {
    wx.setStorageSync('role', 'elder')
    wx.redirectTo({
      url: '/pages/elder/home'
    })
  },

  enterFamily() {
    wx.setStorageSync('role', 'family')
    wx.redirectTo({
      url: '/pages/family/home'
    })
  }
})
