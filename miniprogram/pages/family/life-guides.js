const { getLifeGuidesAPI, deleteLifeGuideAPI } = require("../../api/user");

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

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
        guides: guides.map((item) => ({
          ...item,
          displayTime: formatDateTime(item.updatedAt || item.createdAt)
        }))
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

  goToCreate() {
    wx.navigateTo({
      url: "/pages/family/life-guide-edit"
    });
  },

  goToEdit(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/family/life-guide-edit?guideId=${id}`
    });
  },

  deleteGuide(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.showModal({
      title: "确认删除",
      content: "删除后老人端将无法再查看这份教程，确定继续吗？",
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await deleteLifeGuideAPI(id);
          wx.showToast({ title: "已删除", icon: "success" });
          this.loadGuides();
        } catch (error) {
          wx.showToast({ title: error.message || "删除失败", icon: "none" });
        }
      }
    });
  }
});
