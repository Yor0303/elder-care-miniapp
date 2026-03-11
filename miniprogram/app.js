// app.js
App({
  globalData: {},

  onLaunch() {

    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-1gqc73g3981deae7', // 你的云开发环境ID
      traceUser: true
    })

    // 本地存储
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        console.log(res.code)
        // 可以通过云函数换取 openid
      }
    })

  }

})