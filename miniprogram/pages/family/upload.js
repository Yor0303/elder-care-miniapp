// pages/family/upload.js
Page({

  data:{
    fileUrl:"",
    type:"",
    desc:""
  },

  chooseImage(){
    wx.chooseImage({
      count:1,
      success:(res)=>{
        this.setData({
          fileUrl:res.tempFilePaths[0],
          type:"image"
        })
      }
    })
  },

  chooseVideo(){
    wx.chooseVideo({
      success:(res)=>{
        this.setData({
          fileUrl:res.tempFilePath,
          type:"video"
        })
      }
    })
  },

  onInput(e){
    this.setData({
      desc:e.detail.value
    })
  },

  uploadFile(){
    wx.showToast({
      title:"上传成功(模拟)",
      icon:"success"
    })
  }

})
