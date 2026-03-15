const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const DEMO_USER_KEY = "demo-elder";
const AVATAR_PATHS = {
  grandpa: "../../assets/images/avatar1.png",
  father: "../../assets/images/avatar2.png",
  uncle: "../../assets/images/avatar3.png",
  me: "../../assets/images/avatar4.png",
  child: "../../assets/images/avatar5.png"
};

async function ensureCollections() {
  const names = ["users", "persons"];

  for (const name of names) {
    try {
      await db.createCollection(name);
    } catch (error) {
      // collection already exists
    }
  }
}

async function seedDemoPersons(userId) {
  const personCollection = db.collection("persons");
  const created = {};

  const persons = [
    {
      key: "grandpa",
      name: "爷爷",
      avatar: AVATAR_PATHS.grandpa,
      relation: "祖父",
      age: 78,
      gender: "男",
      health: "良好",
      description: "喜欢给家人讲过去的故事。"
    },
    {
      key: "father",
      parentKey: "grandpa",
      name: "爸爸",
      avatar: AVATAR_PATHS.father,
      relation: "父亲",
      age: 50,
      gender: "男",
      health: "一般",
      description: "非常关心家人。",
      healthStatus: {
        bloodPressure: "130/85",
        heartRate: 70,
        bloodSugar: "5.8"
      },
      memories: [
        {
          id: "m001",
          type: "photo",
          url: AVATAR_PATHS.father,
          time: "2026-03-08",
          desc: "全家聚餐"
        }
      ]
    },
    {
      key: "uncle",
      parentKey: "grandpa",
      name: "叔叔",
      avatar: AVATAR_PATHS.uncle,
      relation: "叔叔",
      age: 48,
      gender: "男",
      health: "良好",
      description: "平时经常回来探望。"
    },
    {
      key: "me",
      parentKey: "father",
      name: "我",
      avatar: AVATAR_PATHS.me,
      relation: "本人",
      age: 25,
      gender: "男",
      health: "健康",
      description: "喜欢记录家庭回忆。"
    },
    {
      key: "child",
      parentKey: "me",
      name: "孩子",
      avatar: AVATAR_PATHS.child,
      relation: "孙子",
      age: 3,
      gender: "男",
      health: "健康",
      description: "家里最活泼的小朋友。"
    }
  ];

  for (const item of persons) {
    const result = await personCollection.add({
      data: {
        elderId: userId,
        parentPersonId: item.parentKey ? created[item.parentKey] : null,
        name: item.name,
        avatar: item.avatar,
        relation: item.relation,
        age: item.age,
        gender: item.gender,
        health: item.health,
        description: item.description,
        healthStatus: item.healthStatus || {
          bloodPressure: "120/80",
          heartRate: 72,
          bloodSugar: "5.6"
        },
        memories: item.memories || []
      }
    });

    created[item.key] = result._id;
  }
}

async function syncDemoPersonAvatars(userId) {
  const personCollection = db.collection("persons");
  const result = await personCollection.where({ elderId: userId }).get();

  const avatarByName = {
    "爷爷": AVATAR_PATHS.grandpa,
    "爸爸": AVATAR_PATHS.father,
    "叔叔": AVATAR_PATHS.uncle,
    "我": AVATAR_PATHS.me,
    "孩子": AVATAR_PATHS.child
  };

  for (const person of result.data) {
    const nextAvatar = avatarByName[person.name];
    if (nextAvatar && person.avatar !== nextAvatar) {
      await personCollection.doc(person._id).update({
        data: {
          avatar: nextAvatar,
          memories: (person.memories || []).map((memory) => ({
            ...memory,
            url: memory.id === "m001" ? AVATAR_PATHS.father : memory.url
          }))
        }
      });
    }
  }
}

async function ensureDemoUser(openid) {
  await ensureCollections();

  const userCollection = db.collection("users");
  const personCollection = db.collection("persons");

  const existingByOpenId = await userCollection.where({ openId: openid }).get();
  if (existingByOpenId.data.length) {
    const existingUser = existingByOpenId.data[0];
    await syncDemoPersonAvatars(existingUser._id);

    if (existingUser.avatar !== AVATAR_PATHS.grandpa) {
      await userCollection.doc(existingUser._id).update({
        data: {
          avatar: AVATAR_PATHS.grandpa
        }
      });
      existingUser.avatar = AVATAR_PATHS.grandpa;
    }

    return existingUser;
  }

  const demoUserResult = await userCollection.where({ demoKey: DEMO_USER_KEY }).get();
  let user = demoUserResult.data[0];

  if (!user) {
    const addResult = await userCollection.add({
      data: {
        demoKey: DEMO_USER_KEY,
        openId: openid,
        name: "张三",
        avatar: AVATAR_PATHS.grandpa,
        age: 78,
        gender: "男",
        userType: "elder",
        relation: "本人",
        healthStatus: {
          bloodPressure: "120/80",
          heartRate: 72,
          bloodSugar: "5.6"
        }
      }
    });

    await seedDemoPersons(addResult._id);
    const createdUser = await userCollection.doc(addResult._id).get();
    return createdUser.data;
  }

  if (user.openId !== openid) {
    await userCollection.doc(user._id).update({
      data: {
        openId: openid
      }
    });
    user.openId = openid;
  }

  const personCount = await personCollection.where({ elderId: user._id }).count();
  if (personCount.total === 0) {
    await seedDemoPersons(user._id);
  } else {
    await syncDemoPersonAvatars(user._id);
  }

  return user;
}

async function login() {
  const wxContext = cloud.getWXContext();
  const user = await ensureDemoUser(wxContext.OPENID);

  return {
    token: `cloud-${wxContext.OPENID}`,
    userType: user.userType || "elder",
    userId: user._id
  };
}

async function getCurrentUser() {
  const wxContext = cloud.getWXContext();
  const result = await db.collection("users").where({ openId: wxContext.OPENID }).get();

  if (!result.data.length) {
    throw new Error("用户不存在，请先登录");
  }

  return result.data[0];
}

async function getPersonList() {
  const user = await getCurrentUser();
  const result = await db.collection("persons").where({ elderId: user._id }).get();

  return result.data.map((person) => ({
    id: person._id,
    name: person.name,
    avatar: person.avatar,
    relation: person.relation,
    age: person.age,
    description: person.description
  }));
}

function buildTree(persons) {
  const nodeMap = new Map();
  const roots = [];

  persons.forEach((person) => {
    nodeMap.set(person._id, {
      id: person._id,
      name: person.name,
      avatar: person.avatar,
      relation: person.relation,
      age: person.age,
      health: person.health || "未知",
      description: person.description,
      children: []
    });
  });

  persons.forEach((person) => {
    const node = nodeMap.get(person._id);
    if (person.parentPersonId && nodeMap.has(person.parentPersonId)) {
      nodeMap.get(person.parentPersonId).children.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
}

async function getFamilyTree() {
  const user = await getCurrentUser();
  const result = await db.collection("persons").where({ elderId: user._id }).get();
  return buildTree(result.data);
}

async function getPersonDetail(event) {
  if (!event.personId) {
    throw new Error("缺少 personId");
  }

  const user = await getCurrentUser();
  const result = await db.collection("persons").doc(event.personId).get();
  const person = result.data;

  if (!person || person.elderId !== user._id) {
    throw new Error("人物不存在");
  }

  return {
    id: person._id,
    name: person.name,
    avatar: person.avatar,
    relation: person.relation,
    age: person.age,
    gender: person.gender,
    healthStatus: person.healthStatus,
    description: person.description,
    memories: person.memories || []
  };
}

async function getElderInfo() {
  const user = await getCurrentUser();

  return {
    id: user._id,
    name: user.name,
    avatar: user.avatar,
    age: user.age,
    gender: user.gender,
    relation: user.relation,
    healthStatus: user.healthStatus
  };
}

exports.main = async (event) => {
  try {
    switch (event.action) {
      case "login":
        return await login();
      case "getPersonList":
        return await getPersonList();
      case "getFamilyTree":
        return await getFamilyTree();
      case "getPersonDetail":
        return await getPersonDetail(event);
      case "getElderInfo":
        return await getElderInfo();
      default:
        throw new Error("未知操作");
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || "云函数执行失败"
    };
  }
};
