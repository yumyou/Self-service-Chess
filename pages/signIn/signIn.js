// pages/signIn/signIn.js
const app = getApp();

Page({
  data: {
    // 用户签到信息
    signInInfo: {
      consecutiveDays: 2, // 连续签到天数
      totalPoints: 20, // 总积分
      todaySigned: false // 今日是否已签到
    },
    // 积分明细列表
    pointsList: [
      {
        id: 1,
        title: '连续1天签到',
        date: '2025-01-29',
        points: 20,
        type: 'signin'
      },
      {
        id: 2,
        title: '连续2天签到',
        date: '2025-01-29',
        points: 20,
        type: 'signin'
      }
    ],
    // 加载状态
    loading: false
  },

  onLoad: function (options) {
    this.getSignInInfo();
  },

  onShow: function () {
    // 页面显示时刷新数据
    this.getSignInInfo();
  },

  // 获取签到信息
  getSignInInfo() {
    const that = this;
    that.setData({
      loading: true
    });

    // 模拟API请求
    setTimeout(() => {
      // 这里应该调用真实的API
      const signInInfo = {
        consecutiveDays: 2,
        totalPoints: 20,
        todaySigned: false
      };

      that.setData({
        signInInfo,
        loading: false
      });
    }, 500);
  },

  // 执行签到
  doSignIn() {
    const that = this;
    
    if (that.data.signInInfo.todaySigned) {
      wx.showToast({
        title: '今日已签到',
        icon: 'none'
      });
      return;
    }

    that.setData({
      loading: true
    });

    // 模拟签到API请求
    setTimeout(() => {
      const newConsecutiveDays = that.data.signInInfo.consecutiveDays + 1;
      const newTotalPoints = that.data.signInInfo.totalPoints + 20;
      
      // 添加新的积分记录
      const newPointsRecord = {
        id: Date.now(),
        title: `连续${newConsecutiveDays}天签到`,
        date: new Date().toISOString().split('T')[0],
        points: 20,
        type: 'signin'
      };

      that.setData({
        'signInInfo.consecutiveDays': newConsecutiveDays,
        'signInInfo.totalPoints': newTotalPoints,
        'signInInfo.todaySigned': true,
        pointsList: [newPointsRecord, ...that.data.pointsList],
        loading: false
      });

      wx.showToast({
        title: '签到成功',
        icon: 'success'
      });
    }, 1000);
  },

  // 查看积分规则
  viewPointsRules() {
    wx.showModal({
      title: '积分规则',
      content: '1. 每日签到可获得20积分\n2. 连续签到有额外奖励\n3. 积分可用于抵扣消费\n4. 积分永久有效',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 返回上一页
  onBack() {
    wx.navigateBack();
  }
}); 