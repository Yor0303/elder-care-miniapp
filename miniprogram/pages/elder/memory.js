const { getMemoriesAPI, getPersonListAPI, getElderInfoAPI } = require("../../api/user");

const TYPE_LABELS = {
  family: "家庭",
  travel: "旅行",
  festival: "节日",
  daily: "日常",
  medical: "医疗",
  childhood: "童年",
  school: "校园",
  work: "工作",
  hometown: "家乡",
  friend: "朋友",
  friendship: "朋友",
  wedding: "婚礼",
  birthday: "生日",
  celebration: "庆祝",
  milestone: "重要时刻",
  portrait: "照片",
  life: "生活",
  holiday: "假日",
  photo: "照片",
  video: "视频"
};

const TYPE_ORDER = [
  "family",
  "childhood",
  "school",
  "friend",
  "friendship",
  "travel",
  "festival",
  "birthday",
  "wedding",
  "celebration",
  "work",
  "hometown",
  "medical",
  "daily",
  "life",
  "holiday",
  "milestone",
  "portrait",
  "photo",
  "video"
];

const BGM_SRC = "/assets/audio/memory-bgm.mp3";
const AUTO_PLAY_INTERVAL = 3200;

function getTypeLabel(type) {
  return TYPE_LABELS[type] || "其他";
}

function normalizeYear(value) {
  const match = String(value || "").match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function normalizeDecade(decade, year) {
  if (decade !== null && decade !== undefined && decade !== "") {
    return String(decade).replace(/[^\d]/g, "").slice(0, 4);
  }

  const numericYear = normalizeYear(year);
  if (!numericYear) {
    return "";
  }

  return String(Math.floor(numericYear / 10) * 10);
}

function safeDecodeQueryValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    return decodeURIComponent(text).trim();
  } catch (_) {
    return text;
  }
}

function normalizeName(value) {
  return String(value || "").trim();
}

function buildPersonRelationMap(persons = []) {
  return (Array.isArray(persons) ? persons : []).reduce((map, item) => {
    const name = normalizeName(item && item.name);
    const relation = normalizeName(item && item.relation);
    if (name) {
      map[name] = relation || "家人";
    }
    return map;
  }, {});
}

function resolveMemoryRelation(item, relationMap, elderName) {
  const person = normalizeName(item && item.person);
  const personRole = normalizeName(item && item.personRole);

  if (personRole === "self" || person === "本人" || person === "自己" || person === "我" || (elderName && person === elderName)) {
    return "本人";
  }

  if (!person) {
    return "";
  }

  return relationMap[person] || (personRole === "family" ? "家人" : "");
}

Page({
  data: {
    showFilter: false,
    showDetail: false,
    expandedSection: "",
    currentMemory: {},
    memories: [],
    list: [],
    decadeOptions: [],
    typeOptions: [],
    activeDecade: "",
    activeType: "",
    activeTypeLabel: "",
    loading: false,
    errorMsg: "",
    queryPerson: "",
    queryRelation: "",
    viewMode: "timeline",
    currentIndex: 0,
    flipMemory: null,
    incomingMemory: null,
    isFlipping: false,
    isSettling: false,
    flipDirection: "next",
    isAutoPlaying: false,
    autoPlayPaused: false,
    bgmEnabled: false
  },

  onLoad(options = {}) {
    this.autoPlayTimer = null;
    this.bgmAudio = wx.createInnerAudioContext();
    this.bgmAudio.loop = true;
    this.bgmAudio.obeyMuteSwitch = false;
    this.bgmAudio.src = BGM_SRC;
    this.bgmAudio.onError(() => {
      if (!this.data.bgmEnabled) return;
      this.setData({ bgmEnabled: false });
      wx.showToast({
        title: "背景音乐暂时不可用",
        icon: "none"
      });
    });

    this.setData({
      queryPerson: safeDecodeQueryValue(options.person)
    });
    this.loadMemories();
  },

  onHide() {
    this.clearAutoPlay();
    this.stopBgm();
  },

  onUnload() {
    this.clearAutoPlay();
    this.stopBgm();
    if (this.bgmAudio) {
      this.bgmAudio.destroy();
      this.bgmAudio = null;
    }
  },

  getSafeIndex(list, index) {
    if (!Array.isArray(list) || !list.length) {
      return 0;
    }
    return Math.max(0, Math.min(Number(index) || 0, list.length - 1));
  },

  applyFilters(memories, decade, type) {
    return (memories || []).filter((item) => {
      if (decade && item.decade !== decade) {
        return false;
      }
      if (type && item.type !== type) {
        return false;
      }
      return true;
    });
  },

  updateListState(extraData = {}) {
    const nextDecade = Object.prototype.hasOwnProperty.call(extraData, "activeDecade")
      ? extraData.activeDecade
      : this.data.activeDecade;
    const nextType = Object.prototype.hasOwnProperty.call(extraData, "activeType")
      ? extraData.activeType
      : this.data.activeType;

    const list = this.applyFilters(this.data.memories, nextDecade, nextType);
    const requestedIndex = Object.prototype.hasOwnProperty.call(extraData, "currentIndex")
      ? extraData.currentIndex
      : this.data.currentIndex;
    const currentIndex = this.getSafeIndex(list, requestedIndex);

    this.setData({
      ...extraData,
      list,
      currentIndex,
      flipMemory: list[currentIndex] || null,
      incomingMemory: null,
      isFlipping: false,
      isSettling: false,
      activeTypeLabel: getTypeLabel(nextType)
    });
  },

  async loadMemories() {
    this.clearAutoPlay();
    this.stopBgm();
    this.setData({
      loading: true,
      errorMsg: "",
      isAutoPlaying: false,
      autoPlayPaused: false
    });

    try {
      const queryParams = {};
      if (this.data.queryPerson) {
        queryParams.person = this.data.queryPerson;
      }

      const [memoriesRaw, persons, elder] = await Promise.all([
        getMemoriesAPI(queryParams),
        getPersonListAPI(),
        getElderInfoAPI()
      ]);
      const memories = Array.isArray(memoriesRaw)
        ? memoriesRaw
        : memoriesRaw && Array.isArray(memoriesRaw.data)
          ? memoriesRaw.data
          : [];
      const elderName = normalizeName(elder && elder.name);
      const relationMap = buildPersonRelationMap(persons);

      const normalized = memories
        .map((item) => ({
          ...item,
          id: item.id || item._id || "",
          year: item.year || "",
          decade: normalizeDecade(item.decade, item.year),
          type: item.type || "daily",
          typeLabel: getTypeLabel(item.type || "daily"),
          img: item.img || "/assets/images/family.jpg",
          relationLabel: resolveMemoryRelation(item, relationMap, elderName),
          title: item.title || "未命名回忆",
          story: item.story || "暂无故事内容",
          person: item.person || "未标注人物"
        }))
        .sort((a, b) => normalizeYear(b.year) - normalizeYear(a.year));

      const decadeOptions = [...new Set(normalized.map((item) => item.decade).filter(Boolean))].sort(
        (a, b) => Number(b) - Number(a)
      );
      const typeOptions = [...new Set(normalized.map((item) => item.type).filter(Boolean))]
        .sort((a, b) => {
          const aIndex = TYPE_ORDER.indexOf(a);
          const bIndex = TYPE_ORDER.indexOf(b);
          const normalizedA = aIndex === -1 ? TYPE_ORDER.length : aIndex;
          const normalizedB = bIndex === -1 ? TYPE_ORDER.length : bIndex;
          if (normalizedA !== normalizedB) {
            return normalizedA - normalizedB;
          }
          return getTypeLabel(a).localeCompare(getTypeLabel(b), "zh-CN");
        })
        .map((type) => ({
          value: type,
          label: getTypeLabel(type)
        }));

      const list = this.applyFilters(normalized, this.data.activeDecade, this.data.activeType);
      const currentIndex = this.getSafeIndex(list, this.data.currentIndex);

      this.setData({
        memories: normalized,
        list,
        decadeOptions,
        typeOptions,
        currentIndex,
        flipMemory: list[currentIndex] || null,
        incomingMemory: null,
        isFlipping: false,
        isSettling: false,
        activeTypeLabel: getTypeLabel(this.data.activeType || ""),
        queryRelation: this.data.queryPerson
          ? resolveMemoryRelation({ person: this.data.queryPerson }, relationMap, elderName)
          : "",
        loading: false
      });
    } catch (error) {
      console.error("加载回忆数据失败:", error);
      this.setData({
        loading: false,
        errorMsg: (error && error.message) || "加载失败，请重试"
      });

      wx.showToast({
        title: "加载失败",
        icon: "none"
      });
    }
  },

  async onPullDownRefresh() {
    await this.loadMemories();
    wx.stopPullDownRefresh();
  },

  setViewMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.viewMode) return;

    this.clearAutoPlay();
    this.stopBgm();
    this.setData({
      viewMode: mode,
      currentIndex: this.getSafeIndex(this.data.list, this.data.currentIndex),
      flipMemory: this.data.list[this.getSafeIndex(this.data.list, this.data.currentIndex)] || null,
      incomingMemory: null,
      isFlipping: false,
      isSettling: false,
      isAutoPlaying: false,
      autoPlayPaused: false
    });
  },

  openMemory(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showDetail: true,
      currentMemory: item || {}
    });
  },

  openCurrentMemory() {
    if (!this.data.flipMemory) return;
    this.setData({
      showDetail: true,
      currentMemory: this.data.flipMemory
    });
  },

  closeDetail() {
    this.setData({
      showDetail: false,
      currentMemory: {}
    });
  },

  openFilter() {
    this.setData({
      showFilter: true,
      expandedSection: ""
    });
  },

  closeFilter() {
    this.setData({
      showFilter: false,
      expandedSection: ""
    });
  },

  toggleSection(e) {
    const section = e.currentTarget.dataset.section || "";
    this.setData({
      expandedSection: this.data.expandedSection === section ? "" : section
    });
  },

  filterDecade(e) {
    const value = e.currentTarget.dataset.value || "";
    this.stopAutoPlay();
    this.updateListState({
      activeDecade: value,
      currentIndex: 0
    });
  },

  filterType(e) {
    const value = e.currentTarget.dataset.value || "";
    this.stopAutoPlay();
    this.updateListState({
      activeType: value,
      currentIndex: 0
    });
  },

  resetFilter() {
    this.stopAutoPlay();
    this.updateListState({
      activeDecade: "",
      activeType: "",
      showFilter: false,
      expandedSection: "",
      currentIndex: 0
    });
  },

  startAutoPlay() {
    if (!this.data.list.length) {
      wx.showToast({
        title: "暂无回忆可放映",
        icon: "none"
      });
      return;
    }

    this.clearAutoPlay();
    this.setData({
      isAutoPlaying: true,
      autoPlayPaused: false
    });
    this.playBgmIfNeeded();
    this.runAutoPlay();
  },

  pauseAutoPlay() {
    this.clearAutoPlay();
    this.pauseBgm();
    this.setData({
      isAutoPlaying: false,
      autoPlayPaused: true
    });
  },

  resumeAutoPlay() {
    if (!this.data.list.length) return;

    this.clearAutoPlay();
    this.setData({
      isAutoPlaying: true,
      autoPlayPaused: false
    });
    this.playBgmIfNeeded();
    this.runAutoPlay();
  },

  stopAutoPlay() {
    this.clearAutoPlay();
    this.stopBgm();
    this.setData({
      isAutoPlaying: false,
      autoPlayPaused: false
    });
  },

  runAutoPlay() {
    this.clearAutoPlay();
    this.autoPlayTimer = setTimeout(() => {
      if (!this.data.isAutoPlaying || this.data.isFlipping || this.data.showDetail) {
        return;
      }

      if (this.data.currentIndex >= this.data.list.length - 1) {
        this.stopAutoPlay();
        wx.showToast({
          title: "回忆放映完成",
          icon: "none"
        });
        return;
      }

      this.switchFlipMemory("next", this.data.currentIndex + 1);
      this.runAutoPlay();
    }, AUTO_PLAY_INTERVAL);
  },

  clearAutoPlay() {
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  },

  toggleBgm() {
    const nextEnabled = !this.data.bgmEnabled;
    this.setData({ bgmEnabled: nextEnabled });

    if (!nextEnabled) {
      this.stopBgm();
      return;
    }

    if (this.data.isAutoPlaying) {
      this.playBgmIfNeeded();
    } else {
      wx.showToast({
        title: "开始放映时会自动播放背景音乐",
        icon: "none"
      });
    }
  },

  playBgmIfNeeded() {
    if (!this.data.bgmEnabled || !this.bgmAudio) return;
    try {
      this.bgmAudio.play();
    } catch (_) {}
  },

  pauseBgm() {
    if (!this.bgmAudio) return;
    try {
      this.bgmAudio.pause();
    } catch (_) {}
  },

  stopBgm() {
    if (!this.bgmAudio) return;
    try {
      this.bgmAudio.stop();
    } catch (_) {}
  },

  prevMemory() {
    if (this.data.isFlipping || this.data.currentIndex <= 0) return;
    this.switchFlipMemory("prev", this.data.currentIndex - 1);
  },

  nextMemory() {
    if (this.data.isFlipping || this.data.currentIndex >= this.data.list.length - 1) return;
    this.switchFlipMemory("next", this.data.currentIndex + 1);
  },

  switchFlipMemory(direction, nextIndex) {
    const nextMemory = this.data.list[nextIndex] || null;
    if (!nextMemory) return;

    this.setData({
      flipDirection: direction,
      isFlipping: true,
      isSettling: false,
      incomingMemory: nextMemory
    });

    setTimeout(() => {
      this.setData({
        currentIndex: nextIndex,
        flipMemory: nextMemory,
        isFlipping: false,
        isSettling: true
      });
    }, 240);

    setTimeout(() => {
      this.setData({
        incomingMemory: null,
        isSettling: false
      });
    }, 520);
  }
});
