const { getLifeGuidesAPI } = require("../../api/user");
const {
  appendPreviewParam,
  isPreviewMode,
  previewLifeGuides
} = require("../../utils/elder-preview");

Page({
  data: {
    previewMode: false,
    loading: false,
    guides: []
  },

  onLoad(options = {}) {
    this.setData({ previewMode: isPreviewMode(options) });
  },

  onShow() {
    this.loadGuides();
  },

  async loadGuides() {
    this.setData({ loading: true });

    try {
      if (this.data.previewMode) {
        this.setData({
          loading: false,
          guides: previewLifeGuides.map((item) => ({ ...item }))
        });
        return;
      }

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
      url: this.data.previewMode
        ? appendPreviewParam(`/pages/elder/life-guide-detail?guideId=${id}`)
        : `/pages/elder/life-guide-detail?guideId=${id}`
    });
  }
});
