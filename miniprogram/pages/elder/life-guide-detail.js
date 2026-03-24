const { getLifeGuideDetailAPI } = require("../../api/user");

function getTempFileURL(fileList) {
  if (!Array.isArray(fileList) || !fileList.length) {
    return Promise.resolve({});
  }

  return wx.cloud.getTempFileURL({ fileList }).then((res) => {
    const urlMap = {};
    (res.fileList || []).forEach((item) => {
      if (item.fileID && item.tempFileURL) {
        urlMap[item.fileID] = item.tempFileURL;
      }
    });
    return urlMap;
  });
}

Page({
  data: {
    loading: false,
    guide: null
  },

  onLoad(options) {
    const guideId = options && options.guideId ? options.guideId : "";
    if (!guideId) {
      this.setData({ guide: null });
      return;
    }

    this.loadGuideDetail(guideId);
  },

  async loadGuideDetail(guideId) {
    this.setData({ loading: true });

    try {
      const guide = await getLifeGuideDetailAPI(guideId);
      const steps = Array.isArray(guide.steps) ? guide.steps : [];
      const imageList = steps.map((step) => step.image).filter(Boolean);
      const urlMap = await getTempFileURL(
        [...imageList, guide.videoFileID].filter(Boolean)
      );

      this.setData({
        loading: false,
        guide: {
          ...guide,
          steps: steps.map((step) => ({
            ...step,
            imageUrl: urlMap[step.image] || ""
          })),
          videoUrl: urlMap[guide.videoFileID] || ""
        }
      });
    } catch (error) {
      this.setData({ loading: false, guide: null });
      wx.showToast({ title: "教程加载失败", icon: "none" });
    }
  }
});
