const {
  appendPreviewParam,
  isPreviewMode,
  previewBindingRequests,
  previewElderProfile,
  previewFamilyMembers,
  previewHealthInfo,
  previewLifeGuides,
  previewMemories
} = require("./elder-preview");

const previewMessageBoardMessages = [
  {
    id: "preview-message-board-1",
    senderName: "小文",
    senderRelation: "女儿",
    createdAt: "2026-04-14T09:20:00.000Z",
    note: "今天降温，记得出门前把外套穿好。",
    messageType: "message",
    hasAudio: false,
    fileID: ""
  },
  {
    id: "preview-message-board-2",
    senderName: "阿姨",
    senderRelation: "爱人",
    createdAt: "2026-04-14T08:00:00.000Z",
    note: "早饭后的降压药已经放在餐桌上了。",
    messageType: "reminder",
    reminderTime: "08:30",
    reminderScheduleType: "daily",
    reminderWeekdays: [1, 2, 3, 4, 5, 6, 7],
    hasAudio: false,
    fileID: ""
  }
];

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length !== 11) {
    return phone || "";
  }
  return `${digits.slice(0, 3)}****${digits.slice(7)}`;
}

function getPreviewBindingState() {
  return {
    currentBoundElder: {
      id: previewElderProfile.id,
      name: previewElderProfile.name,
      gender: previewElderProfile.gender,
      age: previewElderProfile.age,
      phone: previewElderProfile.phone,
      avatar: previewElderProfile.avatar
    },
    sharedElder: {
      id: previewElderProfile.id,
      name: previewElderProfile.name,
      gender: previewElderProfile.gender,
      age: previewElderProfile.age,
      maskedPhone: maskPhone("13800000000")
    },
    pendingRequests: previewBindingRequests.map((item) => ({
      ...item,
      elderName: previewElderProfile.name,
      statusClass: item.status === "approved" ? "approved" : item.status === "rejected" ? "rejected" : "pending"
    })),
    relation: "子女",
    relationIndex: 1
  };
}

function promptPreviewLogin(featureName, role = "family") {
  wx.showModal({
    title: "登录后使用",
    content: `当前展示的是预览数据，如需使用${featureName || "该功能"}并保存真实内容，请先登录/注册。`,
    confirmText: "去登录",
    cancelText: "继续预览",
    success: (res) => {
      if (res.confirm) {
        wx.navigateTo({
          url: `/pages/login/login?auth=1&role=${role === "elder" ? "elder" : "family"}`
        });
      }
    }
  });
}

module.exports = {
  appendPreviewParam,
  getPreviewBindingState,
  isPreviewMode,
  previewElderProfile,
  previewFamilyMembers,
  previewHealthInfo,
  previewLifeGuides,
  previewMemories,
  previewMessageBoardMessages,
  promptPreviewLogin
};
