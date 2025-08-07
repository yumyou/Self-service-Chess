// pages/favorite/favorite.js
const app = getApp()
var http = require('../../utils/http');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    isLogin: app.globalData.isLogin,
    favoriteStores: [], // 收藏的门店列表
    loading: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.setData({
      isLogin: app.globalData.isLogin
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.setData({
      isLogin: app.globalData.isLogin
    });
    
    if (app.globalData.isLogin) {
      this.getFavoriteStores();
    } else {
      this.setData({
        favoriteStores: []
      });
    }
  },

  /**
   * 获取收藏门店列表
   */
  getFavoriteStores: function () {
    const that = this;
    
    if (!app.globalData.isLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    that.setData({
      loading: true
    });

    http.request(
      "/member/favorite/list",
      "1",
      "get",
      {},
      app.globalData.userDatatoken.accessToken,
      "加载中...",
      function success(info) {
        console.log('收藏门店列表:', info);
        if (info.code == 0) {
          that.setData({
            favoriteStores: info.data || [],
            loading: false
          });
        } else {
          wx.showToast({
            title: info.msg || '获取收藏列表失败',
            icon: 'none'
          });
          that.setData({
            loading: false
          });
        }
      },
      function fail(info) {
        console.error('获取收藏列表失败:', info);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
        that.setData({
          loading: false
        });
      }
    );
  },

  /**
   * 跳转到订单提交页面
   */
  goToOrder: function (e) {
    const store = e.currentTarget.dataset.store;
    
    if (!app.globalData.isLogin) {
      wx.navigateTo({
        url: '../login/login',
      });
      return;
    }

    // 跳转到订单提交页面，传递门店信息
    wx.navigateTo({
      url: `../orderSubmit/orderSubmit?storeId=${store.storeId}&storeName=${encodeURIComponent(store.storeName)}`,
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    this.getFavoriteStores();
    wx.stopPullDownRefresh();
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '我的收藏门店',
      path: '/pages/favorite/favorite',
      success: function (res) {
        wx.showToast({
          title: "分享成功",
          icon: 'success',
          duration: 2000
        });
      },
      fail: function (res) {
        // 分享失败
      },
    };
  },
});
