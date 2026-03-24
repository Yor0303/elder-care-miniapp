const {
  addLifeGuideAPI,
  updateLifeGuideAPI,
  getLifeGuideDetailAPI
} = require("../../api/user");

function getTempFileURL(fileList) {
  if (!Array.isArray(fileList) || !fileList.length) {
    return Promise.resolve({});
  }

  return wx.cloud.getTempFileURL({ fileList }).then((res) => {
    const urlMap = {};
    (res.fileList || []).forEach((item) => {
      if (item.fileID && item.tempFileURL) {
        urlMap[item.fileID] = item.tempFileURL;
      }
    });
    return urlMap;
  });
}

function createStep(step = {}, index = 0) {
  return {
    uid: `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    text: step.text || "",
    imageFileID: step.image || "",
    imageTempPath: "",
    imagePreview: step.imagePreview || ""
  };
}

Page({
  data: {
    guideId: "",
    loading: false,
    saving: false,
    title: "",
    itemName: "",
    steps: [createStep({}, 0)],
    videoFileID: "",
    videoTempPath: "",
    videoPreview: ""
  },

  onLoad(options) {
    const guideId = options && options.guideId ? options.guideId : "";
    if (guideId) {
      this.setData({ guideId });
      this.loadGuideDetail(guideId);
    }
  },

  async loadGuideDetail(guideId) {
    this.setData({ loading: true });

    try {
      const guide = await getLifeGuideDetailAPI(guideId);
      const steps = Array.isArray(guide.steps) && guide.steps.length
        ? guide.steps
        : [{ image: guide.coverImage || "", text: guide.content || "" }];
      const imageList = steps.map((step) => step.image).filter(Boolean);
      const urlMap = await getTempFileURL(
        [...imageList, guide.videoFileID].filter(Boolean)
      );

      this.setData({
        loading: false,
        title: guide.title || "",
        itemName: guide.itemName || "",
        steps: steps.map((step, index) =>
          createStep(
            {
              image: step.image || "",
              text: step.text || "",
              imagePreview: urlMap[step.image] || ""
            },
            index
          )
        ),
        videoFileID: guide.videoFileID || "",
        videoPreview: urlMap[guide.videoFileID] || ""
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [field]: e.detail.value
    });
  },

  onStepTextInput(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      [`steps[${index}].text`]: e.detail.value
    });
  },

  addStep() {
    this.setData({
      steps: [...this.data.steps, createStep({}, this.data.steps.length)]
    });
  },

  removeStep(e) {
    const { index } = e.currentTarget.dataset;
    if (this.data.steps.length <= 1) {
      wx.showToast({ title: "至少保留一步", icon: "none" });
      return;
    }

    const steps = this.data.steps.slice();
    steps.splice(index, 1);
    this.setData({ steps });
  },

  chooseStepImage(e) {
    const { index } = e.currentTarget.dataset;
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = (res.tempFilePaths && res.tempFilePaths[0]) || "";
        if (!tempFilePath) return;

        this.setData({
          [`steps[${index}].imageTempPath`]: tempFilePath,
          [`steps[${index}].imagePreview`]: tempFilePath
        });
      }
    });
  },

  chooseVideo() {
    wx.chooseVideo({
      sourceType: ["album", "camera"],
      maxDuration: 180,
      compressed: true,
      success: (res) => {
        if (!res.tempFilePath) return;
        this.setData({
          videoTempPath: res.tempFilePath,
          videoPreview: res.tempFilePath
        });
      }
    });
  },

  clearVideo() {
    this.setData({
      videoFileID: "",
      videoTempPath: "",
      videoPreview: ""
    });
  },

  uploadFile(tempFilePath, folder) {
    return new Promise((resolve, reject) => {
      const extMatch = tempFilePath.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : "";
      const cloudPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;

      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  async buildStepsPayload() {
    const result = [];

    for (let i = 0; i < this.data.steps.length; i += 1) {
      const step = this.data.steps[i];
      const text = (step.text || "").trim();
      let image = step.imageFileID || "";

      if (step.imageTempPath) {
        image = await this.uploadFile(step.imageTempPath, "life-guides/images");
      }

      result.push({
        image,
        text,
        order: i
      });
    }

    return result;
  },

  async saveGuide() {
    if (this.data.saving) return;

    const title = (this.data.title || "").trim();
    const itemName = (this.data.itemName || "").trim();

    if (!title) {
      wx.showToast({ title: "请输入教程标题", icon: "none" });
      return;
    }
    if (!itemName) {
      wx.showToast({ title: "请输入适用物品", icon: "none" });
      return;
    }

    const invalidStep = this.data.steps.find((step) => {
      const text = (step.text || "").trim();
      const hasImage = !!(step.imageFileID || step.imageTempPath);
      return !text || !hasImage;
    });

    if (invalidStep) {
      wx.showToast({ title: "每一步都要有图片和文字", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: "保存中..." });

    try {
      const steps = await this.buildStepsPayload();
      let videoFileID = this.data.videoFileID;

      if (this.data.videoTempPath) {
        videoFileID = await this.uploadFile(this.data.videoTempPath, "life-guides/videos");
      }

      const payload = {
        title,
        itemName,
        steps,
        videoFileID
      };

      if (this.data.guideId) {
        await updateLifeGuideAPI({
          guideId: this.data.guideId,
          ...payload
        });
      } else {
        await addLifeGuideAPI(payload);
      }

      wx.hideLoading();
      this.setData({ saving: false });
      wx.showToast({ title: "保存成功", icon: "success" });

      setTimeout(() => {
        wx.navigateBack();
      }, 400);
    } catch (error) {
      wx.hideLoading();
      this.setData({ saving: false });
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }
  }
});
