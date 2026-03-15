const { getFamilyTreeAPI } = require("../../api/user");

Page({
  data: {
    showCard: false,
    currentPerson: {},
    treeData: []
  },

  async onLoad() {
    try {
      wx.showLoading({ title: "加载中" });
      const treeData = await getFamilyTreeAPI();
      this.setData({ treeData });
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: "加载失败",
        icon: "none"
      });
      console.error("load family tree failed", error);
    }
  },

  showCard(e) {
    const id = e.detail.id;

    const findPerson = (list) => {
      for (const person of list) {
        if (person.id === id) {
          return person;
        }

        if (person.children && person.children.length) {
          const result = findPerson(person.children);
          if (result) {
            return result;
          }
        }
      }

      return null;
    };

    const person = findPerson(this.data.treeData);

    if (person) {
      this.setData({
        currentPerson: person,
        showCard: true
      });
    }
  },

  closeCard() {
    this.setData({
      showCard: false
    });
  }
});
