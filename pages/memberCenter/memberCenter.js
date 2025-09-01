// pages/memberCenter/memberCenter.js
var http = require('../../utils/http');
var util1 = require('../../utils/util.js');
const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userBalance: '0.00',
    activeTab: 'recharge', // 当前激活的标签页
    selectedAmount: '', // 选中的充值金额
    rechargeOptions: [
      { payMoney: 300, giftMoney: 50 },
      { payMoney: 500, giftMoney: 100 },
      { payMoney: 1000, giftMoney: 280 },
      { payMoney: 2000, giftMoney: 600 },
      { payMoney: 5000, giftMoney: 1600 }
    ], // 充值选项列表
    recordList: [], // 账户记录列表
    storeId: '', // 门店ID
    storeName: '', // 门店名称
    stores: [], // 门店列表
    index: 0, // 选中的门店索引
    userId: '' // 用户ID
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.getUserInfo();
    this.getStoreList();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // this.getUserBalance();
  },

  /**
   * 获取用户信息
   */
  getUserInfo: function() {
    var that = this;
    if (app.globalData.isLogin) {
      http.request(
        "/member/user/get",
        "1",
        "get", {},
        app.globalData.userDatatoken.accessToken,
        "",
        function success(info) {
          if (info.code == 0) {
            that.setData({
              userBalance: info.data.balance || '0.00',
              userId: info.data.id
            });
          }
        },
        function fail(info) {
          console.error('获取用户信息失败', info);
        }
      );
    }
  },

  /**
   * 获取门店列表
   */
  getStoreList: function() {
    var that = this;
    if (app.globalData.isLogin) {
      http.request(
        "/member/index/getStoreList",
        "1",
        "get", {
          cityName: ''
        },
        app.globalData.userDatatoken.accessToken,
        "获取中...",
        function success(info) {
          if (info.code == 0 && info.data.length > 0) {
            that.setData({
              stores: info.data,
              storeId: info.data[0].value,
              storeName: info.data[0].key
            });
          }
        },
        function fail(info) {
          console.error('获取门店列表失败', info);
        }
      );
    }
  },

  /**
   * 获取用户余额
   */
  getUserBalance: function() {
    var that = this;
    if (app.globalData.isLogin && that.data.storeId) {
      http.request(
        "/member/user/getStoreBalance/" + that.data.storeId,
        "1",
        "get", {},
        app.globalData.userDatatoken.accessToken,
        "",
        function success(info) {
          if (info.code == 0) {
            that.setData({
              userBalance: info.data.balance || '0.00'
            });
          }
        },
        function fail(info) {
          console.error('获取余额失败', info);
        }
      );
    }
  },

  /**
   * 返回上一页
   */
  goBack: function() {
    wx.navigateBack();
  },

  /**
   * 跳转到消费明细
   */
  goBalanceDetail: function() {
    wx.navigateTo({
      url: '../getBalance/getBalance'
    });
  },

  /**
   * 切换标签页
   */
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    
    if (tab === 'record') {
      this.getRecordList();
    }
  },

  /**
   * 选择充值金额
   */
  selectAmount: function(e) {
    const amount = e.currentTarget.dataset.amount;
    this.setData({
      selectedAmount: amount
    });
  },

  /**
   * 获取账户记录
   */
  getRecordList: function() {
    var that = this;
    if (app.globalData.isLogin) {
      http.request(
        "/member/user/getBalanceRecord",
        "1",
        "get", {
          storeId: that.data.storeId
        },
        app.globalData.userDatatoken.accessToken,
        "获取中...",
        function success(info) {
          if (info.code == 0) {
            that.setData({
              recordList: info.data || []
            });
          }
        },
        function fail(info) {
          console.error('获取账户记录失败', info);
        }
      );
    }
  },

  /**
   * 提交充值
   */
  submitRecharge: function() {
    var that = this;
    if (!that.data.selectedAmount) {
      wx.showToast({
        title: '请选择充值金额',
        icon: 'none'
      });
      return;
    }

    if (app.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '您当前选择的门店为：\r\n【' + that.data.storeName + '】\r\n充值的余额仅该门店可用！确认充值吗？',
        confirmText: '确认',
        complete: (res) => {
          if (res.confirm) {
            that.createRechargeOrder();
          }
        }
      });
    } else {
      wx.navigateTo({
        url: '../login/login'
      });
    }
  },

  /**
   * 创建充值订单
   */
  createRechargeOrder: function() {
    var that = this;
    http.request(
      "/member/user/preRechargeBalance",
      "1",
      "post", {
        "userId": that.data.userId,
        "storeId": that.data.storeId,
        "price": that.data.selectedAmount * 100,
      },
      app.globalData.userDatatoken.accessToken,
      "获取中...",
      function success(info) {
        if (info.code == 0) {
          that.payMent(info);
        } else {
          wx.showModal({
            content: info.msg || '充值失败',
            showCancel: false,
          });
        }
      },
      function fail(info) {
        wx.showToast({
          title: '充值失败',
          icon: 'error'
        });
      }
    );
  },

  /**
   * 微信支付
   */
  payMent: function(pay) {
    var that = this;
    wx.requestPayment({
      'timeStamp': pay.data.timeStamp,
      'nonceStr': pay.data.nonceStr,
      'package': pay.data.pkg,
      'signType': pay.data.signType,
      'paySign': pay.data.paySign,
      'success': function(res) {
        wx.showToast({
          title: '支付成功!',
          icon: 'success'
        });
        // 刷新余额
        that.getUserBalance();
        // 重置选中金额
        that.setData({
          selectedAmount: ''
        });
      },
      'fail': function(res) {
        wx.showToast({
          title: '支付失败!',
          icon: 'error'
        });
      },
      'complete': function(res) {
        console.log('支付完成');
      }
    });
  }
});
