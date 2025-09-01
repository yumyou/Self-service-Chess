// 示例：如何从其他页面跳转到物联网设备管理页面

// 方法1：基础跳转
function navigateToIotDevice() {
  wx.navigateTo({
    url: '/pages/iotDevice/iotDevice'
  });
}

// 方法2：带参数的跳转（如果需要传递设备信息）
function navigateToIotDeviceWithParams(deviceInfo) {
  wx.navigateTo({
    url: `/pages/iotDevice/iotDevice?deviceId=${deviceInfo.deviceId}&deviceName=${deviceInfo.deviceName}`
  });
}

// 方法3：从用户页面添加跳转按钮
// 在用户页面的WXML中添加：
/*
<view class="menu-item" bindtap="goToIotDevice">
  <van-icon name="setting-o" size="20px" />
  <text>物联网设备管理</text>
  <van-icon name="arrow" size="16px" />
</view>
*/

// 在用户页面的JS中添加：
function goToIotDevice() {
  wx.navigateTo({
    url: '/pages/iotDevice/iotDevice',
    success: function() {
      console.log('跳转到物联网设备管理页面成功');
    },
    fail: function(err) {
      console.error('跳转失败:', err);
      wx.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    }
  });
}

// 方法4：在tabBar中添加（需要修改app.json）
// 在app.json的tabBar.list中添加：
/*
{
  "pagePath": "pages/iotDevice/iotDevice",
  "text": "设备管理",
  "iconPath": "pages/static/icon/device.png",
  "selectedIconPath": "pages/static/icon/device-in.png"
}
*/

// 方法5：通过事件触发跳转
function onDeviceManageClick() {
  // 检查用户权限
  if (!app.globalData.isLogin) {
    wx.showModal({
      title: '提示',
      content: '请先登录后再使用设备管理功能',
      confirmText: '去登录',
      success: function(res) {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      }
    });
    return;
  }
  
  // 跳转到设备管理页面
  wx.navigateTo({
    url: '/pages/iotDevice/iotDevice'
  });
}

// 方法6：在订单详情页面添加设备管理入口
function addDeviceManageToOrderDetail() {
  // 在订单详情页面添加一个按钮，用于管理相关设备
  // 例如：房间门锁设备管理
  
  wx.showActionSheet({
    itemList: ['查看设备状态', '设备管理', '取消'],
    success: function(res) {
      switch(res.tapIndex) {
        case 0:
          // 查看设备状态
          wx.navigateTo({
            url: '/pages/iotDevice/iotDevice?tab=0'
          });
          break;
        case 1:
          // 设备管理
          wx.navigateTo({
            url: '/pages/iotDevice/iotDevice?tab=1'
          });
          break;
      }
    }
  });
}

// 方法7：通过扫码跳转到设备管理
function scanAndNavigateToDevice() {
  wx.scanCode({
    success: function(res) {
      // 解析二维码内容，获取设备信息
      const deviceInfo = parseQRCode(res.result);
      if (deviceInfo && deviceInfo.type === 'iot_device') {
        wx.navigateTo({
          url: `/pages/iotDevice/iotDevice?deviceId=${deviceInfo.deviceId}`
        });
      } else {
        wx.showToast({
          title: '无效的设备二维码',
          icon: 'none'
        });
      }
    },
    fail: function(err) {
      wx.showToast({
        title: '扫码失败',
        icon: 'none'
      });
    }
  });
}

// 解析二维码内容
function parseQRCode(qrContent) {
  try {
    // 假设二维码内容是JSON格式
    const data = JSON.parse(qrContent);
    return data;
  } catch (e) {
    // 如果不是JSON格式，尝试其他解析方式
    if (qrContent.includes('deviceId=')) {
      const deviceId = qrContent.split('deviceId=')[1];
      return {
        type: 'iot_device',
        deviceId: deviceId
      };
    }
    return null;
  }
}

// 导出示例方法
module.exports = {
  navigateToIotDevice,
  navigateToIotDeviceWithParams,
  goToIotDevice,
  onDeviceManageClick,
  addDeviceManageToOrderDetail,
  scanAndNavigateToDevice
};



