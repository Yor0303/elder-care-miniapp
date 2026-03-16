const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 数据库集合名称配置
const COLLECTION_NAMES = {
  users: "users",
  persons: "persons",
  memories: "memories",
  healthRecords: "healthRecords"
};

/**
 * 确保集合存在
 */
async function ensureCollections() {
  const collectionNames = Object.values(COLLECTION_NAMES);

  for (const name of collectionNames) {
    try {
      await db.createCollection(name);
    } catch (error) {
      // collection already exists
    }
  }
}

/**
 * 获取当前用户
 */
async function getCurrentUser() {
  const wxContext = cloud.getWXContext();
  const result = await db.collection(COLLECTION_NAMES.users).where({ openId: wxContext.OPENID }).get();

  if (!result.data.length) {
    throw new Error("用户不存在，请先登录");
  }

  return result.data[0];
}

/**
 * 登录 - 创建或获取用户
 */
async function login() {
  await ensureCollections();

  const wxContext = cloud.getWXContext();
  const userCollection = db.collection(COLLECTION_NAMES.users);

  // 查找已存在的用户
  const existingUser = await userCollection.where({ openId: wxContext.OPENID }).get();

  if (existingUser.data.length) {
    const user = existingUser.data[0];
    return {
      token: `cloud-${wxContext.OPENID}`,
      userType: user.userType || "elder",
      userId: user._id
    };
  }

  // 创建新用户 - 基础信息，无演示数据
  const addResult = await userCollection.add({
    data: {
      openId: wxContext.OPENID,
      name: "",
      avatar: "",
      age: null,
      gender: "",
      userType: "elder",
      relation: "本人",
      healthStatus: {
        bloodPressure: "",
        heartRate: null,
        bloodSugar: ""
      },
      createdAt: new Date().toISOString()
    }
  });

  return {
    token: `cloud-${wxContext.OPENID}`,
    userType: "elder",
    userId: addResult._id
  };
}

// ==================== 人物相关 ====================

async function getPersonList() {
  const user = await getCurrentUser();
  const result = await db.collection(COLLECTION_NAMES.persons).where({ elderId: user._id }).get();

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

  // 关系映射：确定父子关系
  const relationParentMap = {
    "祖父": null,      // 祖父是根节点
    "祖母": null,      // 祖母是根节点
    "父亲": ["祖父", "祖母"],  // 父亲的父母是祖父/祖母
    "母亲": null,
    "叔叔": ["祖父", "祖母"],  // 叔叔的父母是祖父/祖母
    "姑姑": ["祖父", "祖母"],
    "本人": ["父亲", "母亲"],  // 本人的父母
    "儿子": ["本人"],
    "女儿": ["本人"],
    "孙子": ["本人", "儿子"],
    "孙女": ["本人", "儿子"]
  };

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

  // 建立父子关系
  persons.forEach((person) => {
    const node = nodeMap.get(person._id);

    // 优先使用数据库中的 parentPersonId
    if (person.parentPersonId && nodeMap.has(person.parentPersonId)) {
      nodeMap.get(person.parentPersonId).children.push(node);
      return;
    }

    // 如果没有 parentPersonId，尝试根据关系推断
    const parentRelations = relationParentMap[person.relation];
    if (parentRelations && parentRelations.length > 0) {
      // 查找具有指定关系的成员
      for (const parentRelation of parentRelations) {
        const parent = persons.find(p => p.relation === parentRelation);
        if (parent && nodeMap.has(parent._id)) {
          nodeMap.get(parent._id).children.push(node);
          return;
        }
      }
    }

    // 没有父节点，作为根节点
    roots.push(node);
  });

  return roots;
}

async function getFamilyTree() {
  const user = await getCurrentUser();
  const result = await db.collection(COLLECTION_NAMES.persons).where({ elderId: user._id }).get();
  return buildTree(result.data);
}

async function getPersonDetail(event) {
  if (!event.personId) {
    throw new Error("缺少 personId");
  }

  const user = await getCurrentUser();
  const result = await db.collection(COLLECTION_NAMES.persons).doc(event.personId).get();
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

/**
 * 添加家庭成员
 */
async function addPerson(event) {
  if (!event.name) {
    throw new Error("姓名不能为空");
  }

  const user = await getCurrentUser();

  const result = await db.collection(COLLECTION_NAMES.persons).add({
    data: {
      elderId: user._id,
      name: event.name,
      avatar: event.avatar || "",
      relation: event.relation || "",
      age: event.age || null,
      gender: event.gender || "",
      health: event.health || "",
      description: event.description || "",
      parentPersonId: event.parentPersonId || null,
      healthStatus: event.healthStatus || {},
      memories: [],
      createdAt: new Date().toISOString()
    }
  });

  return { id: result._id, success: true };
}

/**
 * 更新家庭成员信息
 */
async function updatePerson(event) {
  if (!event.personId) {
    throw new Error("缺少成员ID");
  }

  const user = await getCurrentUser();

  const person = await db.collection(COLLECTION_NAMES.persons).doc(event.personId).get();
  if (!person.data || person.data.elderId !== user._id) {
    throw new Error("成员不存在或无权限修改");
  }

  const updateData = { updatedAt: new Date().toISOString() };
  if (event.name !== undefined) updateData.name = event.name;
  if (event.avatar !== undefined) updateData.avatar = event.avatar;
  if (event.relation !== undefined) updateData.relation = event.relation;
  if (event.age !== undefined) updateData.age = event.age;
  if (event.gender !== undefined) updateData.gender = event.gender;
  if (event.health !== undefined) updateData.health = event.health;
  if (event.description !== undefined) updateData.description = event.description;
  if (event.parentPersonId !== undefined) updateData.parentPersonId = event.parentPersonId;
  if (event.healthStatus !== undefined) updateData.healthStatus = event.healthStatus;

  await db.collection(COLLECTION_NAMES.persons).doc(event.personId).update({
    data: updateData
  });

  return { success: true };
}

/**
 * 删除家庭成员
 */
async function deletePerson(event) {
  if (!event.personId) {
    throw new Error("缺少成员ID");
  }

  const user = await getCurrentUser();

  const person = await db.collection(COLLECTION_NAMES.persons).doc(event.personId).get();
  if (!person.data || person.data.elderId !== user._id) {
    throw new Error("成员不存在或无权限删除");
  }

  await db.collection(COLLECTION_NAMES.persons).doc(event.personId).remove();

  return { success: true };
}

// ==================== 记忆相关 ====================

async function getMemories(event) {
  const user = await getCurrentUser();

  // 构建查询条件
  let query = { elderId: user._id };
  if (event.person) {
    query.person = event.person;
  }
  if (event.decade) {
    query.decade = event.decade;
  }
  if (event.type) {
    query.type = event.type;
  }

  const result = await db
    .collection(COLLECTION_NAMES.memories)
    .where(query)
    .orderBy("year", "asc")
    .get();

  return result.data.map((memory) => ({
    id: memory._id,
    year: memory.year,
    decade: memory.decade,
    type: memory.type,
    title: memory.title,
    img: memory.img,
    story: memory.story,
    person: memory.person,
    createdAt: memory.createdAt
  }));
}

async function addMemory(event) {
  if (!event.title || !event.story) {
    throw new Error("标题和故事内容不能为空");
  }

  const user = await getCurrentUser();

  // 计算年代
  const year = event.year || new Date().getFullYear();
  const decade = Math.floor(year / 10) % 100 + "0";

  const result = await db.collection(COLLECTION_NAMES.memories).add({
    data: {
      elderId: user._id,
      year: year,
      decade: decade,
      type: event.type || "daily",
      title: event.title,
      img: event.img || "",
      story: event.story,
      person: event.person || "",
      createdAt: new Date().toISOString()
    }
  });

  return {
    id: result._id,
    success: true
  };
}

async function updateMemory(event) {
  if (!event.memoryId) {
    throw new Error("缺少记忆ID");
  }

  const user = await getCurrentUser();

  const memory = await db.collection(COLLECTION_NAMES.memories).doc(event.memoryId).get();
  if (!memory.data || memory.data.elderId !== user._id) {
    throw new Error("记忆不存在或无权限修改");
  }

  const updateData = {};
  if (event.title) updateData.title = event.title;
  if (event.story) updateData.story = event.story;
  if (event.img) updateData.img = event.img;
  if (event.person) updateData.person = event.person;
  if (event.type) updateData.type = event.type;
  if (event.year) {
    updateData.year = event.year;
    updateData.decade = Math.floor(event.year / 10) % 100 + "0";
  }
  updateData.updatedAt = new Date().toISOString();

  await db.collection(COLLECTION_NAMES.memories).doc(event.memoryId).update({
    data: updateData
  });

  return { success: true };
}

async function deleteMemory(event) {
  if (!event.memoryId) {
    throw new Error("缺少记忆ID");
  }

  const user = await getCurrentUser();

  const memory = await db.collection(COLLECTION_NAMES.memories).doc(event.memoryId).get();
  if (!memory.data || memory.data.elderId !== user._id) {
    throw new Error("记忆不存在或无权限删除");
  }

  await db.collection(COLLECTION_NAMES.memories).doc(event.memoryId).remove();

  return { success: true };
}

// ==================== 健康数据相关 ====================

async function getHealthInfo(event) {
  const user = await getCurrentUser();

  // 获取既往病史
  const historyResult = await db
    .collection(COLLECTION_NAMES.healthRecords)
    .where({ elderId: user._id, type: "medicalHistory" })
    .get();

  // 获取用药记录
  const medicationResult = await db
    .collection(COLLECTION_NAMES.healthRecords)
    .where({ elderId: user._id, type: "medication" })
    .get();

  return {
    todayHealth: user.healthStatus || {
      bloodPressure: "",
      heartRate: null,
      bloodSugar: ""
    },
    medicalHistory: historyResult.data.map((item) => ({
      id: item._id,
      name: item.name,
      diagnoseYear: item.diagnoseYear,
      notes: item.notes
    })),
    medications: medicationResult.data.map((item) => ({
      id: item._id,
      name: item.name,
      frequency: item.frequency,
      dosage: item.dosage,
      time: item.time,
      notes: item.notes
    }))
  };
}

async function addMedicalHistory(event) {
  if (!event.name) {
    throw new Error("病史名称不能为空");
  }

  const user = await getCurrentUser();

  const result = await db.collection(COLLECTION_NAMES.healthRecords).add({
    data: {
      elderId: user._id,
      type: "medicalHistory",
      name: event.name,
      diagnoseYear: event.diagnoseYear || new Date().getFullYear(),
      notes: event.notes || "",
      createdAt: new Date().toISOString()
    }
  });

  return { id: result._id, success: true };
}

async function addMedication(event) {
  if (!event.name) {
    throw new Error("药物名称不能为空");
  }

  const user = await getCurrentUser();

  const result = await db.collection(COLLECTION_NAMES.healthRecords).add({
    data: {
      elderId: user._id,
      type: "medication",
      name: event.name,
      frequency: event.frequency || "",
      dosage: event.dosage || "",
      time: event.time || "",
      notes: event.notes || "",
      createdAt: new Date().toISOString()
    }
  });

  return { id: result._id, success: true };
}

async function updateTodayHealth(event) {
  const user = await getCurrentUser();

  const updateData = {};
  if (event.bloodPressure !== undefined) updateData["healthStatus.bloodPressure"] = event.bloodPressure;
  if (event.heartRate !== undefined) updateData["healthStatus.heartRate"] = event.heartRate;
  if (event.bloodSugar !== undefined) updateData["healthStatus.bloodSugar"] = event.bloodSugar;

  if (Object.keys(updateData).length > 0) {
    await db.collection(COLLECTION_NAMES.users).doc(user._id).update({
      data: updateData
    });
  }

  return { success: true };
}

async function deleteHealthRecord(event) {
  if (!event.recordId) {
    throw new Error("缺少记录ID");
  }

  const user = await getCurrentUser();

  const record = await db.collection(COLLECTION_NAMES.healthRecords).doc(event.recordId).get();
  if (!record.data || record.data.elderId !== user._id) {
    throw new Error("记录不存在或无权限删除");
  }

  await db.collection(COLLECTION_NAMES.healthRecords).doc(event.recordId).remove();

  return { success: true };
}

// ==================== 云函数入口 ====================

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
      case "addPerson":
        return await addPerson(event);
      case "updatePerson":
        return await updatePerson(event);
      case "deletePerson":
        return await deletePerson(event);
      case "getMemories":
        return await getMemories(event);
      case "addMemory":
        return await addMemory(event);
      case "updateMemory":
        return await updateMemory(event);
      case "deleteMemory":
        return await deleteMemory(event);
      case "getHealthInfo":
        return await getHealthInfo(event);
      case "addMedicalHistory":
        return await addMedicalHistory(event);
      case "addMedication":
        return await addMedication(event);
      case "updateTodayHealth":
        return await updateTodayHealth(event);
      case "deleteHealthRecord":
        return await deleteHealthRecord(event);
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
