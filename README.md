# 忆站 Elder Care Miniapp

一个面向老人记忆支持、家庭陪伴与日常照护的微信小程序项目。

项目采用“双端角色”设计：

- 长辈端：更偏展示与使用，帮助老人看家人、看回忆、看提醒、看教程。
- 家属端：更偏维护与管理，负责建档、上传回忆、管理健康信息、发送留言与提醒。

当前项目基于微信云开发实现，核心业务主要集中在云函数 `cloudfunctions/yizhanService` 中。

## 项目定位

“忆站”关注的不是单点功能，而是老人日常生活中的一组连续需求：

- 容易忘记家庭成员和关系
- 回忆内容分散，缺少持续沉淀
- 健康数据与服药提醒缺少统一入口
- 家人陪伴与沟通不够及时
- 家电、日用品等生活流程容易忘记

因此项目将“回忆支持、远程陪伴、健康照护、生活辅助”整合在一个小程序中。

## 当前功能概览

### 长辈端

- 登录后进入长辈首页，首页集中展示：
  - 家人留言
  - 语音留言
  - 历史上的今天
  - 今日提醒与用药打卡
- 支持未读留言提示，优先尝试 `WechatSI` 插件语音播报，未配置时会退化为震动和 Toast 提示
- 支持查看和刷新绑定二维码，方便邀请家属绑定
- 支持处理家属绑定申请
- 支持人脸识别查看家庭成员资料卡
- 支持“看看家人”家庭关系浏览，查看成员详情与相关回忆
- 支持回忆浏览：
  - 按年代、类型筛选
  - 时间线浏览
  - 放映模式自动翻页
  - 可选背景音乐
- 支持查看今日健康概览、血压/心率/血糖趋势、今日提醒用药
- 支持查看本人资料与“本人回忆”
- 支持主动上传照片或文字回忆素材
- 支持卡片配对记忆游戏
- 支持查看生活小助手教程详情

### 家属端

- 支持注册/登录家属角色
- 支持多种绑定老人方式：
  - 扫码绑定
  - 分享链接跳转绑定
  - 输入手机号查找老人后发起绑定申请
  - 一键进入演示数据模式
- 支持查看当前绑定状态与待审批申请
- 支持维护老人资料：
  - 头像、姓名、手机号、性别、年龄、出生年份
  - 籍贯、地址、紧急联系人
  - 过敏信息、常用药、备注
- 支持维护家庭成员：
  - 姓名、关系、年龄、性别、健康情况、简介
  - 头像
  - 人脸照片
- 新增/编辑成员时会尝试同步人脸到腾讯云 IAI 人脸库
- 支持回忆管理：
  - 查看全部回忆
  - 区分“本人回忆”和“家人回忆”
  - 新增/编辑/删除回忆
  - 上传图片或视频
  - 设置完整事件日期，用于“历史上的今天”
  - 创建卡片配对游戏素材
- 支持留言板：
  - 纯文字留言
  - 语音留言
  - 语音 + 文字备注
  - 定时提醒留言
  - 提醒支持每天、单次、工作日、按星期
- 支持健康管理：
  - 维护病史
  - 维护用药信息
  - 配置服药提醒
  - 更新今日血压、心率、血糖
  - 查看近 7 条趋势图
- 支持生活小助手教程管理：
  - 新增/编辑/删除教程
  - 一个教程可包含多个步骤
  - 每一步支持图片 + 文字说明
  - 可选上传演示视频
- 支持从家属端预览长辈端首页效果

### 云端能力

- 统一云函数分发：`action -> yizhanService`
- 演示数据导入与绑定
- 绑定申请流转
- 家庭成员树构建
- 回忆、健康、留言、教程统一读写
- 今日任务打卡记录
- 腾讯云 IAI 人脸识别接入

## 业务流程

### 1. 登录与角色

- 登录页支持老人 / 家属两个角色注册与登录
- 登录后本地缓存以下信息：
  - `role`
  - `token`
  - `userId`
  - `elderId`（家属绑定老人后写入）
- 页面跳转：
  - 老人 -> `/pages/elder/home`
  - 家属 -> `/pages/family/home`

### 2. 家属绑定老人

当前项目已经实现完整绑定闭环：

- 老人端可生成绑定二维码并分享
- 登录页可接收分享参数 `inviteElderId`
- 家属端绑定页支持扫码、手机号检索、邀请链接进入
- 家属发起申请后，老人端可审批同意或拒绝

### 3. 回忆沉淀

- 家属可上传带日期的回忆内容
- 回忆可标记为“本人”或具体家人
- 长辈端支持按人物、年代、类型浏览
- 首页支持“历史上的今天”回忆展示
- 长辈端还可主动上传文字或照片，作为新的回忆素材输入

### 4. 健康照护

- 家属端负责维护病史、用药和健康测量
- 长辈端展示更简化的健康结果和提醒
- 今日已完成提醒会写入 `daily_task_logs`
- 目前代码中“完成打卡”已落地支持用药提醒

### 5. 人脸识别

- 家属端可为家庭成员上传人脸照
- 云函数会尝试同步到腾讯云 IAI 人脸库
- 长辈端拍照后可识别是否为已录入家庭成员
- 识别成功后返回成员资料卡

## 技术方案

### 前端

- 微信小程序原生开发
- WXML / WXSS / JavaScript
- 微信云开发 `wx.cloud`
- `weui` 扩展库

### 后端

- 微信云函数
- 微信云数据库
- 微信云存储
- 统一业务云函数：`cloudfunctions/yizhanService`

### 第三方能力

- 腾讯云人脸识别 SDK：`tencentcloud-sdk-nodejs`
- 微信云开发服务端 SDK：`wx-server-sdk`

## 目录结构

```text
elder-care-miniapp/
├── miniprogram/
│   ├── app.js
│   ├── app.json
│   ├── api/
│   │   └── user.js
│   ├── components/
│   └── pages/
│       ├── login/
│       ├── elder/
│       │   ├── home/
│       │   ├── family-tree/
│       │   ├── memory/
│       │   ├── health/
│       │   ├── profile/
│       │   ├── upload/
│       │   ├── match/
│       │   ├── life-guides/
│       │   ├── life-guide-detail/
│       │   ├── binding-requests/
│       │   └── face-recognition/
│       ├── family/
│       │   ├── home/
│       │   ├── bind/index/
│       │   ├── members/
│       │   ├── member-edit/
│       │   ├── profile/
│       │   ├── upload/
│       │   ├── memory-edit/
│       │   ├── health-manage/
│       │   ├── message-board/
│       │   ├── life-guides/
│       │   └── life-guide-edit/
│       └── memories/
│           └── index/
├── cloudfunctions/
│   ├── yizhanService/
│   │   ├── index.js
│   │   ├── config.json
│   │   └── demo-data.json
│   └── quickstartFunctions/
├── project.config.json
└── README.md
```

## 核心数据库集合

云函数中实际使用的集合如下：

- `users`
  - 老人 / 家属账号信息
- `persons`
  - 家庭成员资料
- `memories`
  - 回忆内容
- `healthRecords`
  - 病史、用药、每日健康记录
- `daily_task_logs`
  - 长辈当日完成的提醒打卡记录
- `binding_requests`
  - 家属绑定申请
- `elder_uploads`
  - 长辈主动上传的文字或图片素材
- `memory_pairs`
  - 配对记忆游戏素材
- `voice_messages`
  - 家人留言与提醒
- `life_guides`
  - 生活小助手教程

## 云函数动作总览

`miniprogram/api/user.js` 已封装主要接口，统一调用 `yizhanService`。当前云函数已覆盖以下业务类别：

- 账号与登录：`register`、`login`
- 绑定流程：`getBindingQRCode`、`findElderByPhone`、`createBindingRequest`、`approveBindingRequest` 等
- 老人资料与家庭成员：`getElderInfo`、`updateElderInfo`、`getPersonList`、`addPerson`、`updatePerson`
- 回忆：`getMemories`、`addMemory`、`updateMemory`、`deleteMemory`
- 健康：`getHealthInfo`、`addMedicalHistory`、`addMedication`、`updateTodayHealth`
- 留言与提醒：`addVoiceMessage`、`getVoiceMessages`、`markVoiceMessagesRead`
- 教程：`getLifeGuides`、`addLifeGuide`、`updateLifeGuide`、`deleteLifeGuide`
- 游戏素材：`createMemoryPair`、`getMemoryPairs`
- 演示模式：`importDemoData`、`bindCurrentUserToDemoElder`
- 人脸识别：`recognizeFace`

## 开发环境

推荐环境：

- 微信开发者工具
- Node.js 16+
- 已开通的微信云开发环境

项目关键配置：

- 小程序根目录：`miniprogram/`
- 云函数根目录：`cloudfunctions/`
- 当前 `miniprogram/app.js` 中默认云环境 ID：`cloud1-1gqc73g3981deae7`

如果你使用自己的环境，请先修改 `miniprogram/app.js` 中的 `env`。

## 安装与运行

### 1. 安装依赖

根目录依赖：

```bash
npm install
```

云函数依赖：

```bash
cd cloudfunctions/yizhanService
npm install
```

### 2. 使用微信开发者工具导入项目

- 导入仓库根目录
- 确认 `project.config.json` 中的小程序根目录与云函数根目录配置正常
- 打开云开发能力

### 3. 修改云环境

编辑 `miniprogram/app.js`：

```js
wx.cloud.init({
  env: '你的云开发环境ID',
  traceUser: true
})
```

### 4. 部署云函数

至少需要部署：

- `cloudfunctions/yizhanService`

若你修改了云函数逻辑，记得重新部署，否则前端仍会调用旧版本逻辑。

### 5. 可选配置人脸识别环境变量

如果要启用腾讯云人脸识别，需要在云函数环境变量中配置：

```env
FACE_SECRET_ID=你的SecretId
FACE_SECRET_KEY=你的SecretKey
FACE_REGION=ap-shanghai
FACE_SCORE_THRESHOLD=85
```

未配置时，人脸识别功能不可用，但项目其他功能仍可运行。

### 6. 演示模式

家属端绑定页已接入演示模式能力：

- 会调用 `importDemoData`
- 再调用 `bindCurrentUserToDemoElder`

适合答辩、演示、快速联调时直接进入完整样例数据。

## 建议体验流程

建议按下面顺序体验项目：

1. 注册一个老人账号并登录
2. 在老人端生成二维码或分享邀请
3. 注册一个家属账号并完成绑定
4. 在家属端补充老人资料
5. 添加家庭成员并上传头像 / 人脸照
6. 上传回忆内容与卡片配对素材
7. 发送语音留言和提醒
8. 录入病史、用药和今日健康数据
9. 创建生活小助手教程
10. 切换到长辈端查看完整展示效果

## 当前项目状态

当前仓库已经不是简单的页面原型，而是具备完整演示能力的微信小程序项目，适合：

- 比赛展示
- 课程设计 / 毕业设计阶段性成果
- 微信云开发方向的继续迭代

目前已经成型的能力包括：

- 长辈端 / 家属端双角色闭环
- 绑定申请流
- 回忆管理与历史上的今天
- 健康记录与提醒
- 留言板与语音留言
- 生活小助手教程
- 配对记忆游戏
- 演示数据模式
- 腾讯云人脸识别接入

## 注意事项

- 修改云函数后务必重新部署
- 修改小程序页面后需要重新编译
- 腾讯云密钥不要写在前端代码中
- 正式上线前建议补充隐私政策、用户授权提示和异常兜底页面

