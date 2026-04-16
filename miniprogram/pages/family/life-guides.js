const { getLifeGuidesAPI, deleteLifeGuideAPI } = require("../../api/user");
const {
  isPreviewMode,
  previewLifeGuides,
  promptPreviewLogin
} = require("../../utils/family-preview");

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

function getActionValue(e) {
  return (
    (e && e.detail && e.detail.value) ||
    (e && e.detail && e.detail.item && e.detail.item.value) ||
    (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.value) ||
    ""
  );
}

Page({
  data: {
    previewMode: false,
    loading: false,
    guides: [],
    showDeleteDialog: false,
    pendingDeleteGuideId: "",
    deleteDialogButtons: [
      { text: "取消", type: "default", value: "cancel" },
      { text: "删除", type: "warn", value: "confirm" }
    ]
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
          guides: previewLifeGuides.map((item) => ({
            ...item,
            coverUrl: item.coverUrl || item.coverImage || "",
            content: item.content || ((item.steps || []).map((step) => step.text).filter(Boolean).join(" ").slice(0, 60)),
            displayTime: "04-14 09:20"
          }))
        });
        return;
      }

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
    if (this.data.previewMode) {
      promptPreviewLogin("新增生活指南");
      return;
    }
    wx.navigateTo({
      url: "/pages/family/life-guide-edit"
    });
  },

  goToEdit(e) {
    if (this.data.previewMode) {
      promptPreviewLogin("编辑生活指南");
      return;
    }
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/family/life-guide-edit?guideId=${id}`
    });
  },

  deleteGuide(e) {
    if (this.data.previewMode) {
      promptPreviewLogin("删除生活指南");
      return;
    }
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    this.setData({
      showDeleteDialog: true,
      pendingDeleteGuideId: id
    });
  },

  closeDeleteDialog() {
    this.setData({
      showDeleteDialog: false,
      pendingDeleteGuideId: ""
    });
  },

  async onDeleteDialogButtonTap(e) {
    const value = getActionValue(e);
    if (value !== "confirm") {
      this.closeDeleteDialog();
      return;
    }

    const { pendingDeleteGuideId } = this.data;
    if (!pendingDeleteGuideId) {
      this.closeDeleteDialog();
      return;
    }

    try {
      await deleteLifeGuideAPI(pendingDeleteGuideId);
      wx.showToast({ title: "已删除", icon: "success" });
      this.closeDeleteDialog();
      this.loadGuides();
    } catch (error) {
      this.closeDeleteDialog();
      wx.showToast({ title: error.message || "删除失败", icon: "none" });
    }
  }
});
