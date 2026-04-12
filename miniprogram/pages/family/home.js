const { getElderInfoAPI, getTodayCompletedTasksAPI } = require("../../api/user");

const SECTION_META = [
  {
    key: "profile",
    title: "资料建档",
    serial: "01",
    tone: "amber"
  },
  {
    key: "companion",
    title: "陪伴互动",
    serial: "02",
    tone: "rose"
  },
  {
    key: "care",
    title: "照护支持",
    serial: "03",
    tone: "sage"
  }
];

function getSectionActions(hasBoundElder, elderName) {
  return {
    profile: [
      {
        key: "bind",
        title: "绑定老人",
        desc: hasBoundElder ? "查看绑定状态或重新发起绑定。" : "完成绑定后再开启其他功能。"
      },
      {
        key: "profile",
        title: "老人资料",
        desc: "完善基础信息和联系方式。"
      },
      {
        key: "members",
        title: "家庭成员",
        desc: "维护家属关系和成员资料。"
      }
    ],
    companion: [
      {
        key: "memory",
        title: "回忆管理",
        desc: "上传照片和故事，方便随时回看。"
      },
      {
        key: "message",
        title: "家人留言",
        desc: hasBoundElder ? `给 ${elderName} 留下问候。` : "绑定后就可以留下问候。"
      }
    ],
    care: [
      {
        key: "health",
        title: "健康管理",
        desc: "查看用药、记录和每日照护信息。"
      },
      {
        key: "guide",
        title: "生活小助手",
        desc: "整理家电和常用物品教程。"
      }
    ]
  };
}

function buildSectionCards(hasBoundElder, elderName) {
  const actions = getSectionActions(hasBoundElder, elderName);
  const summaries = {
    profile: hasBoundElder ? "绑定、资料、成员统一整理" : "先绑定，再开始建档",
    companion: "回忆和留言集中管理",
    care: "健康与生活支持统一查看"
  };

  return SECTION_META.map((item) => ({
    ...item,
    summary: summaries[item.key],
    count: (actions[item.key] || []).length
  }));
}

function buildSheetActions(section, hasBoundElder, elderName) {
  const actionMap = getSectionActions(hasBoundElder, elderName);
  return (actionMap[section] || []).map((item) => ({
    text: item.title,
    value: item.key
  }));
}

Page({
  data: {
    elderName: "未绑定老人",
    hasBoundElder: false,
    todayCompletedTasks: [],
    tasksLoading: false,
    sectionCards: buildSectionCards(false, "未绑定老人"),
    sectionSheetVisible: false,
    sectionSheetTitle: "",
    sectionSheetActions: [],
    currentSection: ""
  },

  onLoad() {
    this.loadElderName();
  },

  onShow() {
    this.loadElderName();
  },

  async loadElderName() {
    try {
      const elder = await getElderInfoAPI();
      const name = elder && elder.name ? elder.name.trim() : "";

      if (elder && elder.id) {
        wx.setStorageSync("elderId", elder.id);
      }

      if (name) {
        this.setData({ elderName: name, hasBoundElder: true });
        this.syncSectionState(true, name);
        this.loadTodayCompletedTasks();
        return;
      }

      this.setData({ elderName: "已绑定老人", hasBoundElder: true });
      this.syncSectionState(true, "已绑定老人");
      this.loadTodayCompletedTasks();
    } catch (_) {
      wx.removeStorageSync("elderId");
      this.setData({
        elderName: "未绑定老人",
        hasBoundElder: false,
        todayCompletedTasks: [],
        tasksLoading: false
      });
      this.syncSectionState(false, "未绑定老人");
    }
  },

  async loadTodayCompletedTasks() {
    this.setData({ tasksLoading: true });
    try {
      const result = await getTodayCompletedTasksAPI();
      this.setData({
        todayCompletedTasks: Array.isArray(result && result.items) ? result.items : [],
        tasksLoading: false
      });
    } catch (_) {
      this.setData({ todayCompletedTasks: [], tasksLoading: false });
    }
  },

  syncSectionState(hasBoundElder, elderName) {
    this.setData({
      sectionCards: buildSectionCards(hasBoundElder, elderName),
      sectionSheetActions: this.data.sectionSheetVisible
        ? buildSheetActions(this.data.currentSection, hasBoundElder, elderName)
        : this.data.sectionSheetActions
    });
  },

  openSectionPopup(e) {
    const { section } = e.currentTarget.dataset;
    const sectionCard = this.data.sectionCards.find((item) => item.key === section);
    if (!sectionCard) return;

    this.setData({
      currentSection: section,
      sectionSheetVisible: true,
      sectionSheetTitle: `${sectionCard.title} · ${sectionCard.summary}`,
      sectionSheetActions: buildSheetActions(section, this.data.hasBoundElder, this.data.elderName)
    });
  },

  closeSectionPopup() {
    this.setData({
      sectionSheetVisible: false,
      sectionSheetTitle: "",
      sectionSheetActions: [],
      currentSection: ""
    });
  },

  onSelectSectionAction(e) {
    const action = e.detail.value;
    this.closeSectionPopup();

    switch (action) {
      case "bind":
        this.goToBindPage();
        break;
      case "profile":
        this.goToProfile();
        break;
      case "members":
        this.goToMembers();
        break;
      case "memory":
        this.goToMemoryManage();
        break;
      case "message":
        this.goToMessageBoard();
        break;
      case "health":
        this.goToHealthManage();
        break;
      case "guide":
        this.goToLifeGuides();
        break;
      default:
        break;
    }
  },

  ensureBoundElder() {
    if (this.data.hasBoundElder) {
      return true;
    }

    wx.showModal({
      title: "请先绑定老人",
      content: "绑定成功后，才能继续管理老人资料、回忆和健康信息。",
      confirmText: "去绑定",
      success: (res) => {
        if (res.confirm) {
          this.goToBindPage();
        }
      }
    });
    return false;
  },

  goToMemoryManage() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/memories/index"
    });
  },

  goToMembers() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/members"
    });
  },

  goToHealthManage() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/health-manage"
    });
  },

  goToMessageBoard() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/message-board"
    });
  },

  goToLifeGuides() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/life-guides"
    });
  },

  goToProfile() {
    if (!this.ensureBoundElder()) return;
    wx.navigateTo({
      url: "/pages/family/profile"
    });
  },

  goToElderPreview() {
    if (!this.ensureBoundElder()) return;
    wx.reLaunch({
      url: "/pages/elder/home",
      fail: (err) => {
        console.error("enter elder home failed:", err);
      }
    });
  },

  goToBindPage() {
    wx.navigateTo({
      url: "/pages/family/bind/index",
      fail: (err) => {
        console.error("navigate to bind page failed:", err);
      }
    });
  }
});
