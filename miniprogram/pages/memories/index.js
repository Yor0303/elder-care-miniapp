const { getMemoriesAPI, getElderInfoAPI } = require("../../api/user");

function isSelfMemory(item, elderName) {
  if (item && item.personRole === "self") {
    return true;
  }

  const person = item && item.person ? item.person.trim() : "";
  const selfKeys = ["本人", "自己", "我"];
  return !!person && (selfKeys.includes(person) || (elderName && person === elderName));
}

Page({
  data: {
    list: [],
    fullList: [],
    loading: true,
    filterType: "all",
    elderName: ""
  },

  onLoad() {
    this.loadMemories();
  },

  onShow() {
    this.loadMemories();
  },

  async onPullDownRefresh() {
    await this.loadMemories();
    wx.stopPullDownRefresh();
  },

  async loadMemories() {
    this.setData({ loading: true });

    try {
      const [elder, list] = await Promise.all([
        getElderInfoAPI(),
        getMemoriesAPI()
      ]);

      const normalized = Array.isArray(list)
        ? list
        : (list && Array.isArray(list.data) ? list.data : []);

      const elderName = elder && elder.name ? elder.name.trim() : "";
      const withFlags = normalized.map((item) => ({
        ...item,
        isSelf: isSelfMemory(item, elderName),
        eventDateLabel: item && item.eventDate ? String(item.eventDate).slice(0, 10) : `${item.year || ""}`
      }));
      const sorted = withFlags.sort((a, b) => String(b.eventDate || "").localeCompare(String(a.eventDate || "")) || (b.year || 0) - (a.year || 0));
      const filtered = this.applyFilter(sorted, this.data.filterType);

      this.setData({
        fullList: sorted,
        list: filtered,
        loading: false,
        elderName
      });
    } catch (error) {
      console.error("加载回忆失败:", error);
      this.setData({ loading: false });
      const message = error && (error.message || error.msg);
      if (message && message.includes("绑定")) {
        wx.showModal({
          title: "提示",
          content: message,
          showCancel: false,
          success: () => {
            wx.redirectTo({ url: "/pages/family/bind" });
          }
        });
        return;
      }
      wx.showToast({ title: message || "加载失败", icon: "none" });
    }
  },

  applyFilter(list, filterType) {
    if (!list || list.length === 0) return [];
    if (filterType === "all") return list;
    if (filterType === "self") return list.filter((item) => item.isSelf);
    if (filterType === "other") return list.filter((item) => !item.isSelf);
    return list;
  },

  setFilterAll() {
    const list = this.applyFilter(this.data.fullList, "all");
    this.setData({ filterType: "all", list });
  },

  setFilterSelf() {
    const list = this.applyFilter(this.data.fullList, "self");
    this.setData({ filterType: "self", list });
  },

  setFilterOther() {
    const list = this.applyFilter(this.data.fullList, "other");
    this.setData({ filterType: "other", list });
  },

  editMemory(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/family/memory-edit?id=${id}`
    });
  },

  uploadMemory() {
    wx.navigateTo({
      url: "/pages/family/upload"
    });
  }
});
