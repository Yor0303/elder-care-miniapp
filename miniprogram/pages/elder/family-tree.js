const {
  getFamilyTreeAPI,
  getPersonDetailAPI,
  getMemoriesAPI,
  getElderInfoAPI
} = require("../../api/user");

const MAP_SIZE = 620;
const CENTER_X = 290;
const CENTER_Y = 280;
const CENTER_RADIUS = 44;
const MEMBER_SIZE = 110;

function normalizeText(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function flattenFamilyNodes(roots = []) {
  const result = [];
  const queue = [...roots];

  while (queue.length) {
    const node = queue.shift();
    result.push({
      id: node.id,
      name: normalizeText(node.name, "未命名"),
      relation: normalizeText(node.relation, "家人"),
      avatar: normalizeText(node.avatar, ""),
      description: normalizeText(node.description, ""),
      age: node.age || null
    });

    (node.children || []).forEach((child) => queue.push(child));
  }

  return result;
}

function buildMemoryCards(memories = []) {
  return (Array.isArray(memories) ? memories : []).slice(0, 4).map((item) => ({
    id: item.id,
    title: normalizeText(item.title, "未命名回忆"),
    year: normalizeText(item.year, ""),
    story: normalizeText(item.story, "")
  }));
}

function buildOrbitMembers(members = []) {
  if (!members.length) {
    return [];
  }

  const radius = members.length <= 4 ? 185 : 235;
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
    const lineLength = Math.max(0, distance - CENTER_RADIUS - 36);
    const lineAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const lineStartX = CENTER_X + Math.cos(angle) * (CENTER_RADIUS - 6);
    const lineStartY = CENTER_Y + Math.sin(angle) * (CENTER_RADIUS - 6);

    return {
      ...member,
      nodeStyle: `left:${left}rpx; top:${top}rpx;`,
      lineStyle: `left:${lineStartX}rpx; top:${lineStartY}rpx; width:${lineLength}rpx; transform: rotate(${lineAngle}deg);`
    };
  });
}

Page({
  data: {
    loading: true,
    elderCard: null,
    orbitMembers: [],
    selectedNodeId: "",
    selectedPerson: null,
    relatedMemories: [],
    memoryLoading: false
  },

  async onLoad() {
    await this.loadFamilyMap();
  },

  async loadFamilyMap() {
    this.setData({ loading: true });
    try {
      const [roots, elderInfo] = await Promise.all([getFamilyTreeAPI(), getElderInfoAPI()]);
      const members = buildOrbitMembers(flattenFamilyNodes(roots));
      const elderCard = elderInfo
        ? {
            id: elderInfo.id,
            name: normalizeText(elderInfo.name, "我"),
            relation: normalizeText(elderInfo.relation, "本人"),
            avatar: normalizeText(elderInfo.avatar, ""),
            age: elderInfo.age || null
          }
        : null;

      this.setData({
        loading: false,
        elderCard,
        orbitMembers: members,
        selectedNodeId: elderCard ? elderCard.id : "",
        selectedPerson: null,
        relatedMemories: []
      });

      if (elderCard) {
        await this.loadPersonDetail(elderCard.id, elderCard.name, true);
      }
    } catch (error) {
      console.error("load family map failed", error);
      this.setData({ loading: false, elderCard: null, orbitMembers: [] });
      wx.showToast({
        title: "家人关系加载失败",
        icon: "none"
      });
    }
  },

  async handleSelectPerson(event) {
    const { id, name, self } = event.currentTarget.dataset;
    if (!id || id === this.data.selectedNodeId) {
      return;
    }

    this.setData({
      selectedNodeId: id,
      memoryLoading: true
    });

    await this.loadPersonDetail(id, name, !!self);
  },

  async loadPersonDetail(personId, personName, isSelf = false) {
    try {
      const [detail, memories] = await Promise.all(
        isSelf
          ? [getElderInfoAPI(), getMemoriesAPI({ person: "本人" })]
          : [getPersonDetailAPI(personId), getMemoriesAPI({ person: personName })]
      );

      this.setData({
        selectedPerson: {
          id: detail.id,
          name: normalizeText(detail.name, "未命名"),
          relation: normalizeText(detail.relation, isSelf ? "本人" : "家人"),
          avatar: normalizeText(detail.avatar, ""),
          age: detail.age || null,
          gender: normalizeText(detail.gender, "未填写"),
          healthSummary: detail.healthStatus
            ? normalizeText(
                detail.healthStatus.bloodPressure ||
                  detail.healthStatus.heartRate ||
                  detail.healthStatus.bloodSugar,
                "暂无健康摘要"
              )
            : "暂无健康摘要",
          detailDescription: normalizeText(
            detail.description || detail.notes || detail.address,
            "暂无资料介绍"
          )
        },
        relatedMemories: buildMemoryCards(memories),
        memoryLoading: false
      });
    } catch (error) {
      console.error("load person detail failed", error);
      this.setData({
        relatedMemories: [],
        memoryLoading: false
      });
      wx.showToast({
        title: "人物资料加载失败",
        icon: "none"
      });
    }
  },

  handleOpenMemories() {
    const selectedPerson = this.data.selectedPerson;
    if (!selectedPerson || !selectedPerson.name) {
      return;
    }

    wx.navigateTo({
      url: `/pages/elder/memory?person=${encodeURIComponent(selectedPerson.name)}`
    });
  }
});
