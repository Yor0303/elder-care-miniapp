const { getElderInfoAPI, getTodayCompletedTasksAPI } = require("../../api/user");
const { appendPreviewParam } = require("../../utils/family-preview");

const PREVIEW_COMPLETED_TASKS = [
  {
    id: "preview-task-1",
    title: "查看首页预览布局",
    subtitle: "先熟悉家属端入口与功能分区"
  },
  {
    id: "preview-task-2",
    title: "体验资料与照护分区",
    subtitle: "登录后可继续保存和同步真实数据"
  }
];

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
        desc: hasBoundElder ? `给${elderName}留下问候与提醒。` : "绑定后就可以留下问候。"
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

function hasLoginSession() {
  try {
    return !!(wx.getStorageSync("token") || wx.getStorageSync("userId"));
  } catch (_) {
    return false;
  }
}

function getPreviewRoute(action) {
  switch (action) {
    case "bind":
      return "/pages/family/bind/index";
    case "profile":
      return "/pages/family/profile";
    case "members":
      return "/pages/family/members";
    case "memory":
      return "/pages/memories/index";
    case "message":
      return "/pages/family/message-board";
    case "health":
      return "/pages/family/health-manage";
    case "guide":
      return "/pages/family/life-guides";
    default:
      return "";
  }
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
    currentSection: "",
    previewMode: false,
    guestMode: false,
    copy: {
      guestPreviewTitle: "家属端首页预览",
      guestPreviewDesc: "当前为游客预览模式，可先浏览家属首页结构与功能入口，使用具体功能时再登录/注册。",
      guestPreviewAction: "登录/注册",
      guestState: "预览中",
      guestElderName: "体验长辈",
      guestHeroDesc: "可先查看绑定、成员、回忆、健康管理等首页布局，点击具体功能时再进入登录/注册页。",
      guestPrimaryFeature: "体验绑定入口",
      guestSecondaryFeature: "体验老人端入口"
    }
  },

  onLoad(options = {}) {
    const guestMode = String(options.guest || "") === "1" || !hasLoginSession();
    if (guestMode) {
      this.applyGuestPreviewState();
      return;
    }

    this.loadElderName();
  },

  onShow() {
    if (this.data.guestMode) {
      this.applyGuestPreviewState();
      return;
    }

    this.loadElderName();
  },

  applyGuestPreviewState() {
    const elderName = this.data.copy.guestElderName;
    this.setData({
      previewMode: true,
      guestMode: true,
      elderName,
      hasBoundElder: true,
      todayCompletedTasks: PREVIEW_COMPLETED_TASKS,
      tasksLoading: false
    });
    this.syncSectionState(true, elderName);
  },

  goToLogin() {
    wx.navigateTo({
      url: "/pages/login/login?auth=1&role=family"
    });
  },

  promptLoginForFeature(featureName) {
    wx.showModal({
      title: "登录后使用",
      content: `当前为首页预览，若要使用${featureName || "该功能"}，请先进入登录/注册页。`,
      confirmText: "去登录",
      cancelText: "再看看",
      success: (res) => {
        if (res.confirm) {
          this.goToLogin();
        }
      }
    });
  },

  async loadElderName() {
    try {
      const elder = await getElderInfoAPI();
      const name = elder && elder.name ? elder.name.trim() : "";

      if (elder && elder.id) {
        wx.setStorageSync("elderId", elder.id);
      }

      if (name) {
        this.setData({
          elderName: name,
          hasBoundElder: true,
          previewMode: false,
          guestMode: false
        });
        this.syncSectionState(true, name);
        this.loadTodayCompletedTasks();
        return;
      }

      this.setData({
        elderName: "已绑定老人",
        hasBoundElder: true,
        previewMode: false,
        guestMode: false
      });
      this.syncSectionState(true, "已绑定老人");
      this.loadTodayCompletedTasks();
    } catch (_) {
      wx.removeStorageSync("elderId");
      this.setData({
        elderName: "未绑定老人",
        hasBoundElder: false,
        todayCompletedTasks: [],
        tasksLoading: false,
        previewMode: false,
        guestMode: false
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
    const actionItem = (this.data.sectionSheetActions || []).find((item) => item.value === action);
    this.closeSectionPopup();

    if (this.data.guestMode) {
      const previewRoute = getPreviewRoute(action);
      if (previewRoute) {
        wx.navigateTo({
          url: appendPreviewParam(previewRoute)
        });
        return;
      }
      this.promptLoginForFeature(actionItem ? actionItem.text : "该功能");
      return;
    }

    if (this.data.guestMode) {
      this.promptLoginForFeature(actionItem ? actionItem.text : "该功能");
      return;
    }

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

  ensureBoundElder(featureName) {
    if (this.data.guestMode) {
      this.promptLoginForFeature(featureName);
      return false;
    }

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
    if (this.data.guestMode) {
      wx.navigateTo({
        url: appendPreviewParam("/pages/memories/index")
      });
      return;
    }
    if (!this.ensureBoundElder("回忆管理")) return;
    wx.navigateTo({
      url: "/pages/memories/index"
    });
  },

  goToMembers() {
    if (this.data.guestMode) {
      wx.navigateTo({
        url: appendPreviewParam("/pages/family/members")
      });
      return;
    }
    if (!this.ensureBoundElder("家庭成员")) return;
    wx.navigateTo({
      url: "/pages/family/members"
    });
  },

  goToHealthManage() {
    if (this.data.guestMode) {
      wx.navigateTo({
        url: appendPreviewParam("/pages/family/health-manage")
      });
      return;
    }
    if (!this.ensureBoundElder("健康管理")) return;
    wx.navigateTo({
      url: "/pages/family/health-manage"
    });
  },

  goToMessageBoard() {
    if (this.data.guestMode) {
      wx.navigateTo({
        url: appendPreviewParam("/pages/family/message-board")
      });
      return;
    }
    if (!this.ensureBoundElder("家人留言")) return;
    wx.navigateTo({
      url: "/pages/family/message-board"
    });
  },

  goToLifeGuides() {
    if (this.data.guestMode) {
      wx.navigateTo({
        url: appendPreviewParam("/pages/family/life-guides")
      });
      return;
    }
    if (!this.ensureBoundElder("生活小助手")) return;
    wx.navigateTo({
      url: "/pages/family/life-guides"
    });
  },

  goToProfile() {
    if (this.data.guestMode) {
      wx.navigateTo({
        url: appendPreviewParam("/pages/family/profile")
      });
      return;
    }
    if (!this.ensureBoundElder("老人资料")) return;
    wx.navigateTo({
      url: "/pages/family/profile"
    });
  },

  goToElderPreview() {
    if (this.data.guestMode) {
      wx.reLaunch({
        url: "/pages/elder/home?guest=1&from=familyPreview"
      });
      return;
    }
    if (this.data.guestMode) {
      this.promptLoginForFeature("老人端功能");
      return;
    }

    if (!this.ensureBoundElder("老人端功能")) return;
    wx.reLaunch({
      url: "/pages/elder/home",
      fail: (err) => {
        console.error("enter elder home failed:", err);
      }
    });
  },

  goToBindPage() {
    if (this.data.guestMode) {
      wx.navigateTo({
        url: appendPreviewParam("/pages/family/bind/index")
      });
      return;
    }
    if (this.data.guestMode) {
      this.promptLoginForFeature("绑定老人");
      return;
    }

    wx.navigateTo({
      url: "/pages/family/bind/index",
      fail: (err) => {
        console.error("navigate to bind page failed:", err);
      }
    });
  }
});
