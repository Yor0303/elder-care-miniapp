// api/user.js

export const loginAPI = (data) => {
  return wx.request({
    url: 'https://example.com/login',
    method: 'POST',
    data
  })
}