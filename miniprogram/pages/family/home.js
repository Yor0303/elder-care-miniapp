// pages/family/home.js
Page({
  goToUpload(){
    wx.navigateTo({
      url:'/pages/family/upload'
    });
  },

  goToManage(){
    wx.navigateTo({
      url:'/pages/family/members'
    });
  }
})
