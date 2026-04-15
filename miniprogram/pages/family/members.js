// pages/family/members.js
const { getPersonListAPI } = require("../../api/user");
const {
  isPreviewMode,
  previewFamilyMembers,
  promptPreviewLogin
} = require("../../utils/family-preview");

function resolveTempFileURLs(fileIDs = []) {
  const validFileIDs = Array.from(new Set((Array.isArray(fileIDs) ? fileIDs : []).filter((item) => typeof item === "string" && item.startsWith("cloud://"))));
  if (!validFileIDs.length) {
    return Promise.resolve({});
  }

  return wx.cloud.getTempFileURL({ fileList: validFileIDs }).then((res) => {
    const urlMap = {};
    (res.fileList || []).forEach((item) => {
      if (item.fileID && (item.tempFileURL || item.tempFileUrl)) {
        urlMap[item.fileID] = item.tempFileURL || item.tempFileUrl;
      }
    });
    return urlMap;
  }).catch(() => ({}));
}

Page({
  data: {
    previewMode: false,
    loading: false,
    members: []
  },

  onLoad(options = {}) {
    this.setData({ previewMode: isPreviewMode(options) });
    this.loadMembers();
  },

  onShow() {
    this.loadMembers();
  },

  async loadMembers() {
    this.setData({ loading: true });

    try {
      if (this.data.previewMode) {
        this.setData({
          members: previewFamilyMembers.map((item) => ({ ...item })),
          loading: false
        });
        return;
      }

      const members = await getPersonListAPI();
      const urlMap = await resolveTempFileURLs((members || []).map((item) => item && item.avatar));

      this.setData({
        members: (members || []).map((item) => ({
          ...item,
          avatar: urlMap[item.avatar] || item.avatar || ""
        })),
        loading: false
      });

    } catch (error) {
      console.error("加载成员失败:", error);
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  async onPullDownRefresh() {
    await this.loadMembers();
    wx.stopPullDownRefresh();
  },

  /**
   * 编辑成员
   */
  editMember(e) {
    if (this.data.previewMode) {
      promptPreviewLogin("编辑家庭成员");
      return;
    }
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/family/member-edit?id=${id}`
    });
  },

  /**
   * 添加新成员
   */
  addMember() {
    if (this.data.previewMode) {
      promptPreviewLogin("新增家庭成员");
      return;
    }
    wx.navigateTo({
      url: '/pages/family/member-edit'
    });
  }
});
