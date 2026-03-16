// pages/elder/health.js
const { getHealthInfoAPI, updateTodayHealthAPI } = require("../../api/user");

Page({

  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    errorMsg: "",

    // 今日健康数据
    todayHealth: {
      bloodPressure: "--/--",
      heartRate: "--",
      bloodSugar: "--"
    },

    // 既往病史
    medicalHistory: [],

    // 当前用药
    medications: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.loadHealthInfo();
  },

  /**
   * 从云端加载健康信息
   */
  async loadHealthInfo() {
    this.setData({ loading: true, errorMsg: "" });

    try {
      const healthInfo = await getHealthInfoAPI();

      this.setData({
        todayHealth: healthInfo.todayHealth,
        medicalHistory: healthInfo.medicalHistory,
        medications: healthInfo.medications,
        loading: false
      });

    } catch (error) {
      console.error("加载健康信息失败:", error);
      this.setData({
        loading: false,
        errorMsg: error.message || "加载失败，请重试"
      });

      wx.showToast({
        title: "加载失败",
        icon: "none"
      });
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadHealthInfo();
    wx.stopPullDownRefresh();
  },

  /**
   * 更新今日健康数据
   */
  async updateHealthData() {
    wx.showModal({
      title: "更新健康数据",
      editable: true,
      placeholderText: "请输入血压值（如 120/80）",
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await updateTodayHealthAPI({ bloodPressure: res.content });
            await this.loadHealthInfo();
            wx.showToast({ title: "更新成功", icon: "success" });
          } catch (error) {
            wx.showToast({ title: "更新失败", icon: "none" });
          }
        }
      }
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})