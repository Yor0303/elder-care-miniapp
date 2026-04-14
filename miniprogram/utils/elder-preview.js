function isPreviewMode(options = {}) {
  return String(options.preview || "") === "1";
}

function appendPreviewParam(url) {
  if (!url) return url;
  return `${url}${url.includes("?") ? "&" : "?"}preview=1`;
}

const previewMemories = [
  {
    id: "preview-memory-1",
    year: "1982",
    decade: "1980",
    type: "family",
    title: "院子里的团圆饭",
    story: "每到节日，一家人会把小桌子搬到院子里，一边包饺子一边聊天，这些熟悉的声音和笑脸就是最安心的回忆。",
    person: "李阿姨",
    personRole: "family",
    img: "/assets/images/avatar1.png"
  },
  {
    id: "preview-memory-2",
    year: "1996",
    decade: "1990",
    type: "travel",
    title: "第一次去海边",
    story: "那次全家一起看日出、捡贝壳，照片虽然简单，但每次翻看都能想起当时轻松自在的心情。",
    person: "小文",
    personRole: "family",
    img: "/assets/images/avatar1.png"
  },
  {
    id: "preview-memory-3",
    year: "2008",
    decade: "2000",
    type: "daily",
    title: "老照片里的下午茶",
    story: "退休以后，最喜欢在窗边坐一会儿，喝茶、晒太阳、看看家人新发来的照片，日子慢下来也很有味道。",
    person: "体验访客",
    personRole: "self",
    img: "/assets/images/avatar1.png"
  },
  {
    id: "preview-memory-4",
    year: "2024",
    decade: "2020",
    type: "daily",
    title: "视频里的儿童节演出",
    story: "乐乐把学校演出视频发到家人群里，晚上一起看了好几遍，家里的聊天也热闹了起来。",
    person: "乐乐",
    personRole: "family",
    img: "/assets/images/avatar1.png"
  }
];

const previewFamilyMembers = [
  {
    id: "preview-family-1",
    name: "李阿姨",
    relation: "爱人",
    avatar: "/assets/images/avatar1.png",
    description: "平时喜欢做饭和整理家里，也会陪着一起翻看旧相册。",
    age: 67,
    gender: "女",
    detailDescription: "她负责把家里的旧照片和重要纪念日整理出来，很多回忆相册内容都由她一起补充。",
    memories: [
      {
        id: "preview-family-memory-1",
        title: "结婚照",
        year: "1980",
        story: "黑白照片虽然已经发黄，但每次看到都能回想起当年的热闹和亲友祝福。"
      },
      {
        id: "preview-family-memory-2",
        title: "一起搬进新家",
        year: "1992",
        story: "那天忙到很晚，大家坐在地上吃面，却觉得新生活就这样开始了。"
      }
    ],
    loaded: true,
    loading: false
  },
  {
    id: "preview-family-2",
    name: "小文",
    relation: "女儿",
    avatar: "/assets/images/avatar1.png",
    description: "常常远程帮忙记录生活提醒，也会上传新的家庭照片。",
    age: 38,
    gender: "女",
    detailDescription: "她会在家属端整理生活指南、提醒事项和语音留言，方便长辈随时查看。",
    memories: [
      {
        id: "preview-family-memory-3",
        title: "毕业那天",
        year: "2006",
        story: "一家人专门请假去参加毕业典礼，照片里每个人都笑得很开心。"
      }
    ],
    loaded: true,
    loading: false
  },
  {
    id: "preview-family-3",
    name: "乐乐",
    relation: "外孙",
    avatar: "/assets/images/avatar1.png",
    description: "喜欢用视频和照片分享最近的学习和生活。",
    age: 10,
    gender: "男",
    detailDescription: "孩子会把画画作品和节日祝福传上来，让家里的互动更频繁。",
    memories: [
      {
        id: "preview-family-memory-4",
        title: "儿童节演出",
        year: "2024",
        story: "第一次站上舞台有点紧张，但看到家人在台下挥手就放松了。"
      }
    ],
    loaded: true,
    loading: false
  }
];

const previewElderProfile = {
  id: "preview-elder",
  name: "体验访客",
  relation: "本人",
  avatar: "/assets/images/avatar1.png",
  age: 68,
  gender: "男",
  birthYear: "1958",
  hometown: "江苏苏州",
  address: "苏州市姑苏区演示地址",
  emergencyContactName: "小文",
  emergencyContactPhone: "13800000000",
  allergies: "无明显过敏史",
  medications: "降压药、维生素",
  notes: "当前为游客预览模式，可先浏览页面内容。",
  phone: "登录后可绑定手机号"
};

const previewHealthInfo = {
  todayHealth: {
    bloodPressure: "126/78",
    heartRate: "72",
    bloodSugar: "5.6"
  },
  medicalHistory: [
    {
      id: "preview-history-1",
      name: "高血压",
      diagnoseYear: "2018",
      notes: "按医嘱规律复查，平时注意清淡饮食。"
    }
  ],
  medications: [
    {
      id: "preview-med-1",
      name: "缬沙坦",
      frequency: "每日一次",
      time: "早餐后",
      reminderEnabled: true,
      reminderTime: "08:30",
      activeToday: true
    },
    {
      id: "preview-med-2",
      name: "钙片",
      frequency: "每日一次",
      time: "晚餐后",
      reminderEnabled: true,
      reminderTime: "19:00",
      activeToday: true
    }
  ],
  healthTrend: [
    {
      label: "2026-04-08",
      systolic: 132,
      diastolic: 82,
      heartRate: 74,
      bloodSugar: 5.8
    },
    {
      label: "2026-04-10",
      systolic: 128,
      diastolic: 80,
      heartRate: 73,
      bloodSugar: 5.7
    },
    {
      label: "2026-04-12",
      systolic: 127,
      diastolic: 79,
      heartRate: 71,
      bloodSugar: 5.5
    },
    {
      label: "2026-04-14",
      systolic: 126,
      diastolic: 78,
      heartRate: 72,
      bloodSugar: 5.6
    }
  ]
};

const previewLifeGuides = [
  {
    id: "preview-guide-1",
    title: "电饭煲煮饭",
    itemName: "厨房电器",
    hasVideo: false,
    coverUrl: "/assets/images/avatar1.png",
    steps: [
      {
        order: 1,
        text: "量好米后加水，按下煮饭键即可开始。",
        imageUrl: "/assets/images/avatar1.png"
      },
      {
        order: 2,
        text: "煮好后先焖几分钟，再打开盖子口感更好。",
        imageUrl: "/assets/images/avatar1.png"
      }
    ],
    videoUrl: ""
  },
  {
    id: "preview-guide-2",
    title: "空调调到制冷模式",
    itemName: "客厅空调",
    hasVideo: false,
    coverUrl: "/assets/images/avatar1.png",
    steps: [
      {
        order: 1,
        text: "按遥控器开关键，再按模式键切换到雪花图标。",
        imageUrl: "/assets/images/avatar1.png"
      },
      {
        order: 2,
        text: "温度建议先设到 26 度，体感会更舒适。",
        imageUrl: "/assets/images/avatar1.png"
      }
    ],
    videoUrl: ""
  }
];

const previewBindingRequests = [
  {
    id: "preview-request-1",
    applicantName: "小文",
    relation: "女儿",
    phone: "13800000000",
    status: "pending",
    requestTime: "04-14 09:20",
    statusText: "待处理"
  },
  {
    id: "preview-request-2",
    applicantName: "李阿姨",
    relation: "爱人",
    phone: "13900000000",
    status: "approved",
    requestTime: "04-12 18:10",
    statusText: "已绑定"
  },
  {
    id: "preview-request-3",
    applicantName: "小张",
    relation: "外甥",
    phone: "13700000000",
    status: "rejected",
    requestTime: "04-08 14:32",
    statusText: "已拒绝"
  }
];

const previewMatchCards = [
  {
    id: "preview-pair-1a",
    pairId: "preview-pair-1",
    type: "name",
    img: "",
    text: "李阿姨",
    flipped: false,
    matched: false
  },
  {
    id: "preview-pair-1b",
    pairId: "preview-pair-1",
    type: "img",
    img: "/assets/images/avatar1.png",
    text: "",
    flipped: false,
    matched: false
  },
  {
    id: "preview-pair-2a",
    pairId: "preview-pair-2",
    type: "name",
    img: "",
    text: "小文",
    flipped: false,
    matched: false
  },
  {
    id: "preview-pair-2b",
    pairId: "preview-pair-2",
    type: "img",
    img: "/assets/images/avatar1.png",
    text: "",
    flipped: false,
    matched: false
  }
];

module.exports = {
  appendPreviewParam,
  isPreviewMode,
  previewBindingRequests,
  previewElderProfile,
  previewFamilyMembers,
  previewHealthInfo,
  previewLifeGuides,
  previewMatchCards,
  previewMemories
};
