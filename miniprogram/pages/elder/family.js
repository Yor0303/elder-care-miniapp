// pages/elder/family.js
Page({
  data: {
    familyList: []
  },

  onLoad() {
    // 假数据
    this.setData({
      familyList: [
        { id: 1, name: '爸爸', avatar: '/assets/images/avatar1.png' },
        { id: 2, name: '妈妈', avatar: '/assets/images/avatar2.png' },
        { id: 3, name: '孙子', avatar: '/assets/images/avatar3.png' }
      ]
    })
  },

  // 点击家属头像跳转人物详情
  goToProfile(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/elder/profile?familyId=${id}`
    })
  }

})