// pages/elder/family-tree.js
const { getPersonListAPI } = require("../../api/user");

Page({
  data: {
    persons: [],
    currentIndex: 0,
    currentPerson: null,
    nextPerson: null,
    prevPerson: null,
    flipPerson: null,
    flipDirection: "next",
    flipClass: "",
    flipping: false
  },

  async onLoad() {
    await this.loadPersons();
  },

  async loadPersons() {
    try {
      wx.showLoading({ title: "加载中" });
      const persons = await getPersonListAPI();
      wx.hideLoading();

      this.setData({ persons: persons || [] });
      this.setCurrentIndex(0);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: "加载失败", icon: "none" });
      console.error("load persons failed", error);
    }
  },

  setCurrentIndex(index) {
    const persons = this.data.persons || [];
    if (!persons.length) {
      this.setData({
        currentIndex: 0,
        currentPerson: null,
        nextPerson: null,
        prevPerson: null
      });
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, persons.length - 1));
    const prevIndex = Math.max(0, safeIndex - 1);
    const nextIndex = Math.min(persons.length - 1, safeIndex + 1);

    const currentPerson = persons[safeIndex];
    const prevPerson = persons[prevIndex];
    const nextPerson = persons[nextIndex];

    this.setData({
      currentIndex: safeIndex,
      currentPerson,
      prevPerson,
      nextPerson,
      flipPerson: nextPerson,
      flipDirection: "next"
    });
  },

  handleNext() {
    if (this.data.flipping) return;
    const persons = this.data.persons || [];
    if (this.data.currentIndex >= persons.length - 1) {
      wx.showToast({ title: "已经是最后一页", icon: "none" });
      return;
    }

    this.setData({
      flipping: true,
      flipClass: "flip-next",
      flipDirection: "next",
      flipPerson: this.data.nextPerson
    });
    setTimeout(() => {
      this.setCurrentIndex(this.data.currentIndex + 1);
      this.setData({ flipping: false, flipClass: "" });
    }, 600);
  },

  handlePrev() {
    if (this.data.flipping) return;
    if (this.data.currentIndex <= 0) {
      wx.showToast({ title: "已经是第一页", icon: "none" });
      return;
    }

    this.setData({
      flipping: true,
      flipClass: "flip-prev",
      flipDirection: "prev",
      flipPerson: this.data.prevPerson
    });
    setTimeout(() => {
      this.setCurrentIndex(this.data.currentIndex - 1);
      this.setData({ flipping: false, flipClass: "" });
    }, 600);
  }
});
