const {
  getFamilyTreeAPI,
  getPersonDetailAPI,
  getMemoriesAPI,
  getElderInfoAPI
} = require("../../api/user");

const RELATION_ORDER = [
  ["老伴", "配偶", "爱人", "丈夫", "妻子"],
  ["儿子", "女儿", "子女"],
  ["孙子", "孙女", "外孙", "外孙女"],
  ["父亲", "母亲", "爸爸", "妈妈"],
  ["哥哥", "姐姐", "弟弟", "妹妹"],
  ["叔叔", "阿姨", "舅舅", "姑姑", "伯伯", "姨妈"],
  ["亲属", "家属", "朋友", "护工"]
];

const MAP_SIZE = 620;
const CENTER_X = 310;
const CENTER_Y = 286;
const CENTER_RADIUS = 48;
const MEMBER_SIZE = 116;

function normalizeText(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function getRelationRank(relation = "") {
  const text = String(relation || "");
  const matchedIndex = RELATION_ORDER.findIndex((group) => group.some((keyword) => text.includes(keyword)));
  return matchedIndex === -1 ? RELATION_ORDER.length : matchedIndex;
}

function flattenFamilyNodes(roots = []) {
  const result = [];
  const queue = Array.isArray(roots) ? [...roots] : [];

  while (queue.length) {
    const node = queue.shift();
    result.push({
      id: node.id,
      name: normalizeText(node.name, "未命名家人"),
      relation: normalizeText(node.relation, "家人"),
      avatar: normalizeText(node.avatar, ""),
      description: normalizeText(node.description, ""),
      age: node.age || null,
      gender: "",
      detailDescription: "",
      memories: [],
      loaded: false,
      loading: false
    });

    (node.children || []).forEach((child) => queue.push(child));
  }

  return result.sort((a, b) => {
    const rankDiff = getRelationRank(a.relation) - getRelationRank(b.relation);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function buildMemoryCards(memories = []) {
  return (Array.isArray(memories) ? memories : []).slice(0, 3).map((item) => ({
    id: item.id,
    title: normalizeText(item.title, "未命名回忆"),
    year: normalizeText(item.year, ""),
    story: normalizeText(item.story, "这段回忆还没有补充内容。")
  }));
}

function buildOrbitMembers(members = [], selectedNodeId = "") {
  if (!members.length) {
    return [];
  }

  const radius = members.length <= 4 ? 190 : 236;
  const startAngle = members.length === 2 ? -55 : -90;
  const step = 360 / members.length;

  return members.map((member, index) => {
    const angle = ((startAngle + step * index) * Math.PI) / 180;
    const nodeCenterX = CENTER_X + radius * Math.cos(angle);
    const nodeCenterY = CENTER_Y + radius * Math.sin(angle);
    const left = nodeCenterX - MEMBER_SIZE / 2;
    const top = nodeCenterY - MEMBER_SIZE / 2;

    const dx = nodeCenterX - CENTER_X;
    const dy = nodeCenterY - CENTER_Y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const lineLength = Math.max(0, distance - CENTER_RADIUS - 42);
    const lineAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const lineStartX = CENTER_X + Math.cos(angle) * (CENTER_RADIUS - 6);
    const lineStartY = CENTER_Y + Math.sin(angle) * (CENTER_RADIUS - 6);

    return {
      ...member,
      active: member.id === selectedNodeId,
      nodeStyle: `left:${left}rpx; top:${top}rpx;`,
      lineStyle: `left:${lineStartX}rpx; top:${lineStartY}rpx; width:${lineLength}rpx; transform: rotate(${lineAngle}deg);`
    };
  });
}

Page({
  data: {
    loading: true,
    elderCard: null,
    familyMembers: [],
    overviewMembers: [],
    currentPage: 0,
    currentMember: null,
    selectedNodeId: "",
    totalPages: 1
  },

  async onLoad() {
    await this.loadAlbumData();
  },

  async loadAlbumData() {
    this.setData({ loading: true });
    try {
      const [roots, elderInfo] = await Promise.all([getFamilyTreeAPI(), getElderInfoAPI()]);
      const familyMembers = flattenFamilyNodes(roots);
      const elderCard = {
        id: elderInfo && elderInfo.id ? elderInfo.id : "self",
        name: normalizeText(elderInfo && elderInfo.name, "我"),
        relation: "本人",
        avatar: normalizeText(elderInfo && elderInfo.avatar, "")
      };

      this.setData({
        loading: false,
        elderCard,
        familyMembers,
        overviewMembers: buildOrbitMembers(familyMembers, ""),
        currentPage: 0,
        currentMember: null,
        selectedNodeId: "",
        totalPages: familyMembers.length + 1
      });

      if (familyMembers[0]) {
        this.ensurePersonLoaded(0);
      }
    } catch (error) {
      console.error("load album data failed", error);
      this.setData({
        loading: false,
        elderCard: null,
        familyMembers: [],
        overviewMembers: [],
        currentPage: 0,
        currentMember: null,
        selectedNodeId: "",
        totalPages: 1
      });
      wx.showToast({
        title: "家人资料加载失败",
        icon: "none"
      });
    }
  },

  handleSelectOverview(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.familyMembers.length) {
      return;
    }

    this.goToPage(index + 1);
  },

  handleSwiperChange(event) {
    const currentPage = Number(event.detail.current) || 0;
    if (currentPage === 0) {
      this.setData({
        currentPage,
        currentMember: null,
        overviewMembers: buildOrbitMembers(this.data.familyMembers, this.data.selectedNodeId)
      });
      return;
    }

    const index = currentPage - 1;
    const member = this.data.familyMembers[index];
    if (!member) return;

    this.setData({
      currentPage,
      currentMember: { ...member },
      selectedNodeId: member.id,
      overviewMembers: buildOrbitMembers(this.data.familyMembers, member.id)
    });
    this.ensurePersonLoaded(index);
  },

  goToPage(currentPage) {
    const page = Math.max(0, Math.min(currentPage, this.data.totalPages - 1));
    if (page === 0) {
      this.setData({
        currentPage: page,
        currentMember: null,
        overviewMembers: buildOrbitMembers(this.data.familyMembers, this.data.selectedNodeId)
      });
      return;
    }

    const index = page - 1;
    const member = this.data.familyMembers[index];
    if (!member) {
      return;
    }

    this.setData({
      currentPage: page,
      currentMember: { ...member },
      selectedNodeId: member.id,
      overviewMembers: buildOrbitMembers(this.data.familyMembers, member.id)
    });
    this.ensurePersonLoaded(index);
  },

  handlePrevPage() {
    const { currentPage, totalPages } = this.data;
    if (totalPages <= 1) {
      return;
    }
    this.goToPage(currentPage === 0 ? totalPages - 1 : currentPage - 1);
  },

  handleNextPage() {
    const { currentPage, totalPages } = this.data;
    if (totalPages <= 1) {
      return;
    }
    this.goToPage(currentPage === totalPages - 1 ? 0 : currentPage + 1);
  },

  async ensurePersonLoaded(index) {
    const member = this.data.familyMembers[index];
    if (!member || member.loaded || member.loading) {
      return;
    }

    this.setData({
      [`familyMembers[${index}].loading`]: true
    });

    try {
      const [detail, memories] = await Promise.all([
        getPersonDetailAPI(member.id),
        getMemoriesAPI({ person: member.name })
      ]);

      const detailPatch = {
        [`familyMembers[${index}].age`]: detail.age || null,
        [`familyMembers[${index}].gender`]: normalizeText(detail.gender, ""),
        [`familyMembers[${index}].detailDescription`]: normalizeText(detail.description, "这位家人的介绍还没有补充。"),
        [`familyMembers[${index}].memories`]: buildMemoryCards(memories),
        [`familyMembers[${index}].loaded`]: true,
        [`familyMembers[${index}].loading`]: false
      };

      if (this.data.currentPage === index + 1) {
        detailPatch.currentMember = {
          ...this.data.familyMembers[index],
          age: detail.age || null,
          gender: normalizeText(detail.gender, ""),
          detailDescription: normalizeText(detail.description, "这位家人的介绍还没有补充。"),
          memories: buildMemoryCards(memories),
          loaded: true,
          loading: false
        };
      }

      this.setData(detailPatch);
    } catch (error) {
      console.error("load person detail failed", error);
      const failPatch = {
        [`familyMembers[${index}].detailDescription`]: "这位家人的资料暂时没有加载成功。",
        [`familyMembers[${index}].memories`]: [],
        [`familyMembers[${index}].loaded`]: true,
        [`familyMembers[${index}].loading`]: false
      };

      if (this.data.currentPage === index + 1) {
        failPatch.currentMember = {
          ...this.data.familyMembers[index],
          detailDescription: "这位家人的资料暂时没有加载成功。",
          memories: [],
          loaded: true,
          loading: false
        };
      }

      this.setData(failPatch);
      wx.showToast({
        title: "家人资料加载失败",
        icon: "none"
      });
    }
  },

  handleOpenMemories() {
    const member = this.data.currentMember || this.data.familyMembers[this.data.currentPage - 1];
    const personName = String(member && member.name ? member.name : "").trim();
    if (!personName) {
      return;
    }

    wx.navigateTo({
      url: `/pages/elder/memory?person=${encodeURIComponent(personName)}`
    });
  }
});
