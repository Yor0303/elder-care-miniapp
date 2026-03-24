const { getLifeGuidesAPI } = require("../../api/user");

Page({
  data: {
    loading: false,
    guides: []
  },

  onShow() {
    this.loadGuides();
  },

  async loadGuides() {
    this.setData({ loading: true });

    try {
      const list = await getLifeGuidesAPI();
      const guides = await this.attachCoverUrls(Array.isArray(list) ? list : []);
      this.setData({
        loading: false,
        guides
      });
    } catch (error) {
      this.setData({ loading: false, guides: [] });
      wx.showToast({ title: "教程加载失败", icon: "none" });
    }
  },

  attachCoverUrls(list) {
    const fileList = list.map((item) => item.coverImage).filter(Boolean);
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
        coverUrl: urlMap[item.coverImage] || ""
      }));
    });
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/elder/life-guide-detail?guideId=${id}`
    });
  }
});
