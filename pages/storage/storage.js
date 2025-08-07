// pages/storage/storage.js
const app = getApp();

Page({
  data: {
    // 当前模式：'select' | 'deposit' | 'retrieve'
    currentMode: 'select',
    // 柜门信息
    cabinetInfo: {
      doorNumber: 'A-01',
      status: 'closed' // 'closed' | 'opening' | 'open' | 'closing'
    },
    // 操作状态
    operationStatus: {
      loading: false,
      message: ''
    },
    // 存取记录
    storageRecords: []
  },

  onLoad: function (options) {
    // 如果有传入模式参数，直接进入对应模式
    if (options.mode) {
      this.setData({
        currentMode: options.mode
      });
      
      if (options.mode === 'deposit') {
        this.startDeposit();
      } else if (options.mode === 'retrieve') {
        this.startRetrieve();
      }
    }
  },

  // 选择存杆模式
  selectDeposit() {
    this.setData({
      currentMode: 'deposit'
    });
    this.startDeposit();
  },

  // 选择取杆模式
  selectRetrieve() {
    this.setData({
      currentMode: 'retrieve'
    });
    this.startRetrieve();
  },

  // 开始存杆流程
  startDeposit() {
    const that = this;
    that.setData({
      'operationStatus.loading': true,
      'operationStatus.message': '正在打开柜门...'
    });

    // 模拟打开柜门
    setTimeout(() => {
      that.setData({
        'cabinetInfo.status': 'open',
        'operationStatus.loading': false,
        'operationStatus.message': '柜门已打开,请存件,完成关闭柜门'
      });
    }, 2000);
  },

  // 开始取杆流程
  startRetrieve() {
    const that = this;
    that.setData({
      'operationStatus.loading': true,
      'operationStatus.message': '正在打开柜门...'
    });

    // 模拟打开柜门
    setTimeout(() => {
      that.setData({
        'cabinetInfo.status': 'open',
        'operationStatus.loading': false,
        'operationStatus.message': '柜门已打开,请取件,完成关闭柜门'
      });
    }, 2000);
  },

  // 确认操作完成
  confirmOperation() {
    const that = this;
    that.setData({
      'operationStatus.loading': true,
      'operationStatus.message': '正在关闭柜门...'
    });

    // 模拟关闭柜门
    setTimeout(() => {
      that.setData({
        'cabinetInfo.status': 'closed',
        'operationStatus.loading': false,
        'operationStatus.message': ''
      });

      // 记录操作
      const record = {
        id: Date.now(),
        type: that.data.currentMode,
        doorNumber: that.data.cabinetInfo.doorNumber,
        time: new Date().toLocaleString(),
        status: 'completed'
      };

      that.setData({
        storageRecords: [record, ...that.data.storageRecords]
      });

      wx.showToast({
        title: that.data.currentMode === 'deposit' ? '存件成功' : '取件成功',
        icon: 'success'
      });

      // 返回选择模式
      setTimeout(() => {
        that.setData({
          currentMode: 'select'
        });
      }, 1500);
    }, 2000);
  },

  // 取消操作
  cancelOperation() {
    const that = this;
    that.setData({
      'operationStatus.loading': true,
      'operationStatus.message': '正在关闭柜门...'
    });

    // 模拟关闭柜门
    setTimeout(() => {
      that.setData({
        'cabinetInfo.status': 'closed',
        'operationStatus.loading': false,
        'operationStatus.message': ''
      });

      wx.showToast({
        title: '操作已取消',
        icon: 'none'
      });

      // 返回选择模式
      that.setData({
        currentMode: 'select'
      });
    }, 1500);
  },

  // 查看操作记录
  viewRecords() {
    wx.showModal({
      title: '操作记录',
      content: this.data.storageRecords.length > 0 
        ? this.data.storageRecords.map(record => 
            `${record.type === 'deposit' ? '存件' : '取件'} - ${record.doorNumber} - ${record.time}`
          ).join('\n')
        : '暂无操作记录',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 返回上一页
  onBack() {
    if (this.data.currentMode !== 'select') {
      this.cancelOperation();
    } else {
      wx.navigateBack();
    }
  }
}); 