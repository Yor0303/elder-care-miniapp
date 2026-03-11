Page({

  data: {

    showFilter: false,
    showDecade: false,
    showType: false,

    showStory: false,
    currentMemory: {},

    memories: [],
    list: []

  },

  onLoad(options) {

    const memories = [

      {
        id: 1,
        year: 1995,
        decade: "90",
        type: "family",
        title: "结婚照片",
        img: "/assets/images/m1.jpg",
        story: "这是1995年我们的结婚照片，那天全家人都来了，非常开心。",
        person: "爷爷"
      },

      {
        id: 2,
        year: 2001,
        decade: "00",
        type: "family",
        title: "孩子出生",
        img: "/assets/images/m2.jpg",
        story: "2001年孩子出生时拍的照片，那是我们最幸福的一天。",
        person: "奶奶"
      },

      {
        id: 3,
        year: 2010,
        decade: "10",
        type: "travel",
        title: "全家旅行",
        img: "/assets/images/m3.jpg",
        story: "2010年全家一起去旅行，在海边留下了这张照片。",
        person: "爷爷"
      }

    ]

    memories.sort((a, b) => a.year - b.year)

    if (options.person) {

      const result = memories.filter(item => {
        return item.person === options.person
      })

      this.setData({
        memories,
        list: result
      })

    } else {

      this.setData({
        memories,
        list: memories
      })

    }

  },

  // 打开故事卡片
  openMemory(e) {

    const item = e.currentTarget.dataset.item

    this.setData({
      showStory: true,
      currentMemory: item
    })

  },

  closeStory() {

    this.setData({
      showStory: false
    })

  },

  // 语音播放
  playStory() {

    const text = this.data.currentMemory.story

    const audio = wx.createInnerAudioContext()

    audio.src = "https://tts.baidu.com/text2audio?lan=zh&ie=UTF-8&spd=4&text=" + text

    audio.play()

  },

  // 打开筛选
  openFilter() {
    this.setData({
      showFilter: true
    })
  },

  closeFilter() {
    this.setData({
      showFilter: false
    })
  },

  toggleDecade() {

    this.setData({
      showDecade: !this.data.showDecade,
      showType: false
    })

  },

  toggleType() {

    this.setData({
      showType: !this.data.showType,
      showDecade: false
    })

  },

  filterDecade(e) {

    const value = e.currentTarget.dataset.value

    const result = this.data.memories.filter(item => {
      return item.decade == value
    })

    this.setData({
      list: result,
      showFilter: false
    })

  },

  filterType(e) {

    const value = e.currentTarget.dataset.value

    const result = this.data.memories.filter(item => {
      return item.type == value
    })

    this.setData({
      list: result,
      showFilter: false
    })

  },

  resetFilter() {

    this.setData({
      list: this.data.memories,
      showFilter: false
    })

  },

  startStory() {

    let index = 0

    const timer = setInterval(() => {

      if (index >= this.data.list.length) {
        clearInterval(timer)
        return
      }

      wx.pageScrollTo({
        scrollTop: index * 350,
        duration: 800
      })

      index++

    }, 4000)

  }

})