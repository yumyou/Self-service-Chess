// pages/iotDevice/iotDevice.js
const app = getApp();
var http = require("../../utils/http.js");

Page({
  /**
   * 页面的初始数据
   */
  data: {
    statusBarHeight: "",
    titleBarHeight: "",
    // 设备配置信息
    deviceConfig: {
      username: "YH18129635675",
      password: "18129635675",
      deviceName: "H4GAAL3002257111144",
      productKey: "a10VqNZhdXD" // 需要根据实际情况配置
    },
    // Token相关
    token: "",
    tokenExpiresIn: 0,
    tokenExpireTime: 0,
    
    // 设备信息
    deviceInfo: {},
    deviceStatus: 0, // 0-未激活 1-在线 3-离线 8-禁用
    deviceProperties: [],
    deviceTemplate: {},
    templateProperties: [],
    propertyValues: {},
    // enum 选择弹层
    showEnumPicker: false,
    enumPickerColumns: [],
    enumPickerIdentifier: '',
    
    // 属性选择弹层
    showPropertyPicker: false,
    propertyPickerColumns: [],
    
    // 设备列表
    deviceList: [],
    currentPage: 1,
    pageSize: 20,
    totalDevices: 0,
    
    // 历史数据
    historyData: [],
    historyStartTime: "",
    historyEndTime: "",
    historyStartTs: 0,
    historyEndTs: 0,
    minDate: 0,
    maxDate: 0,
    
    // UI状态
    activeTab: 0, // 0-设备信息 1-设备列表 2-历史数据
    loading: false,
    refreshing: false,
    
    // 时间选择器
    showStartTimePicker: false,
    showEndTimePicker: false,
    
    // 属性设置
    propertyIdentifier: "",
    propertyValue: "",
    
    // 状态文本映射
    statusTextMap: {
      0: "未激活",
      1: "在线", 
      3: "离线",
      8: "禁用"
    },
    
    // 状态颜色映射
    statusColorMap: {
      0: "#999999",
      1: "#07c160",
      3: "#ff4d4f", 
      8: "#faad14"
    },
    // 控制开关状态（可根据属性回填真实值）
    chswt1On: false,
    chswt2On: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.setData({
      statusBarHeight: wx.getStorageSync("statusBarHeight"),
      titleBarHeight: wx.getStorageSync("titleBarHeight"),
    });
    
    // 初始化时间范围
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const minDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).getTime();
    const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).getTime();
    
    this.setData({
      historyStartTime: this.formatDate(oneDayAgo),
      historyEndTime: this.formatDate(now),
      historyStartTs: oneDayAgo.getTime(),
      historyEndTs: now.getTime(),
      minDate: minDate,
      maxDate: maxDate
    });
    
    // 获取Token并加载设备信息
    this.getToken();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 检查Token是否过期
    if (this.data.token && Date.now() > this.data.tokenExpireTime) {
      this.getToken();
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({ refreshing: true });
    this.refreshData();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.activeTab === 1) {
      this.loadMoreDevices();
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '物联网设备管理',
      path: '/pages/iotDevice/iotDevice'
    };
  },

  // ==================== API接口调用 ====================

  /**
   * 获取云端资源Token
   */
  getToken() {
    const { username, password } = this.data.deviceConfig;
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);
    wx.request({
      url: `http://hkapi.tchjjc.com/api/token?username=${encodedUsername}&pwd=${encodedPassword}`,
      method: 'POST',
      success: (res) => {
        console.log(res)
        if (res.data && res.data.code === 200) {
          const expireTime = Date.now() + (res.data.expiresIn || 0) * 1000;
          this.setData({
            token: res.data.token || '',
            tokenExpiresIn: res.data.expiresIn || 0,
            tokenExpireTime: expireTime
          });
          // 获取设备信息
          this.getDeviceInfo();
        } else {
          wx.showToast({
            title: (res.data && res.data.message) ? res.data.message : '获取Token失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        console.error('获取Token失败:', err);
      }
    });
  },

  /**
   * 获取设备基本信息
   */
  getDeviceInfo() {
    const { token, deviceConfig } = this.data;
    
    const url = this.buildUrl('http://hkapi.tchjjc.com/api/thing/info', {
      token: token,
      pk: deviceConfig.productKey,
      deviceName: deviceConfig.deviceName
    });
    wx.request({
      url: url,
      method: 'POST',
      header: this.buildHeaders(),
      success: (res) => {
        if (res.data.code === 200) {
          const payload = this.extractPayload(res);
          this.setData({
            deviceInfo: payload || {},
            deviceStatus: (payload && payload.status) || 0
          });
          
          // 获取设备属性
          this.getDeviceProperties();
          // 获取设备模板
          this.getDeviceTemplate();
        } else {
          wx.showToast({
            title: res.data.message || '获取设备信息失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        console.error('获取设备信息失败:', err);
      }
    });
  },

  /**
   * 获取设备的属性
   */
  getDeviceProperties() {
    const { token, deviceConfig } = this.data;
    
    const url = this.buildUrl('http://hkapi.tchjjc.com/api/thing/properties', {
      token: token,
      pk: deviceConfig.productKey,
      deviceName: deviceConfig.deviceName
    });
    wx.request({
      url: url,
      method: 'POST',
      header: this.buildHeaders(),
      success: (res) => {
        if (res.data.code === 200) {
          const payload = this.extractPayload(res);
          this.setData({
            deviceProperties: Array.isArray(payload) ? payload : (payload || [])
          });
        } else {
          wx.showToast({
            title: res.data.message || '获取设备属性失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('获取设备属性失败:', err);
      }
    });
  },

  /**
   * 获取设备的属性模板
   */
  getDeviceTemplate() {
    const { token, deviceConfig } = this.data;
    
    const url = this.buildUrl('http://hkapi.tchjjc.com/api/thing/tsl', {
      token: token,
      pk: deviceConfig.productKey,
      deviceName: deviceConfig.deviceName
    });
    wx.request({
      url: url,
      method: 'POST',
      header: this.buildHeaders(),
      success: (res) => {
        if (res.data.code === 200) {
          const payload = this.extractPayload(res);
          const template = payload || {};
          const props = Array.isArray(template.properties) ? template.properties : [];
          this.setData({
            deviceTemplate: template,
            templateProperties: props
          }, () => {
            this.hydratePropertyValuesFromSnapshot();
          });
        } else {
          wx.showToast({
            title: res.data.message || '获取设备模板失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('获取设备模板失败:', err);
      }
    });
  },

  // 将属性快照映射到可编辑值
  hydratePropertyValuesFromSnapshot() {
    const values = {};
    const snapshot = this.data.deviceProperties || [];
    snapshot.forEach(item => {
      // item.attribute / item.value
      if (item && item.attribute !== undefined) values[item.attribute] = item.value;
    });
    this.setData({ propertyValues: values });
  },

  // 改变布尔/数值/文本值
  onChangePropertyInput(e) {
    const identifier = e.currentTarget.dataset.identifier;
    const value = e.detail && (e.detail.value !== undefined ? e.detail.value : e.detail);
    const propertyValues = { ...this.data.propertyValues };
    propertyValues[identifier] = value;
    this.setData({ propertyValues });
    console.log('属性值已更新:', identifier, value); // 调试日志
  },

  // 布尔开关（保存为 1/0 字符串）
  onChangePropertySwitch(e) {
    const identifier = e.currentTarget.dataset.identifier;
    const raw = e.detail && (e.detail.value !== undefined ? e.detail.value : e.detail);
    const isOn = !!raw;
    const propertyValues = { ...this.data.propertyValues };
    propertyValues[identifier] = isOn ? '1' : '0';
    this.setData({ propertyValues });
    
    // 自动调用接口设置属性
    this.setDeviceProperty(identifier, isOn ? '1' : '0');
  },

  // 打开枚举选择
  openEnumPicker(e) {
    const identifier = e.currentTarget.dataset.identifier;
    const item = (this.data.templateProperties || []).find(p => p.identifier === identifier);
    if (!item) return;
    const specs = (item.dataType && item.dataType.specs) || {};
    const columns = Object.keys(specs).map(k => ({ text: specs[k], value: k }));
    this.setData({
      showEnumPicker: true,
      enumPickerColumns: [columns],
      enumPickerIdentifier: identifier
    });
  },

  // 选择枚举值
  onEnumConfirm(e) {
    const selected = e.detail && e.detail.value ? e.detail.value[0] : null;
    const identifier = this.data.enumPickerIdentifier;
    if (!identifier || !selected) {
      this.setData({ showEnumPicker: false });
      return;
    }
    const propertyValues = { ...this.data.propertyValues };
    propertyValues[identifier] = selected.value; // 枚举保存 key
    this.setData({ propertyValues, showEnumPicker: false, enumPickerIdentifier: '', enumPickerColumns: [] });
    console.log('枚举值已选择:', identifier, selected.value);
  },

  onEnumCancel() {
    this.setData({ showEnumPicker: false, enumPickerIdentifier: '', enumPickerColumns: [] });
  },

  // 批量设置所有可写属性
  onSubmitAllProperties() {
    const writable = (this.data.templateProperties || []).filter(p => (p.accessMode || '').includes('w'));
    if (writable.length === 0) {
      wx.showToast({ title: '无可设置属性', icon: 'none' });
      return;
    }
    
    console.log('开始批量设置属性，可写属性数量:', writable.length);
    
    let successCount = 0;
    let totalCount = 0;
    
    writable.forEach(prop => {
      const identifier = prop.identifier;
      const value = this.data.propertyValues[identifier];
      if (value === undefined) return;
      
      totalCount++;
      console.log('批量设置属性:', identifier, value);
      
      // 使用延时避免请求过于频繁
      setTimeout(() => {
        this.setDeviceProperty(identifier, value);
        successCount++;
        if (successCount === totalCount) {
          wx.showToast({ title: `批量设置完成，共${totalCount}个属性`, icon: 'success' });
        }
      }, totalCount * 100);
    });
    
    if (totalCount === 0) {
      wx.showToast({ title: '没有可设置的属性值', icon: 'none' });
    }
  },

  // 单个下发当前属性
  onSubmitSingleProperty(e) {
    const identifier = e.currentTarget.dataset.identifier;
    if (!identifier) {
      console.log('未找到属性标识符');
      return;
    }
    const value = this.data.propertyValues[identifier];
    console.log('准备下发属性:', identifier, value);
    if (value === undefined) {
      wx.showToast({ title: '请先填写或选择属性值', icon: 'none' });
      return;
    }
    this.setDeviceProperty(identifier, value);
  },

  /**
   * 设置设备的属性
   */
  setDeviceProperty(identifier, value) {
    const { token, deviceConfig } = this.data;
    
    console.log('开始设置设备属性:', identifier, value, 'token:', token);
    
    const url = this.buildUrl('http://hkapi.tchjjc.com/api/thing/properties/set', {
      token: token,
      pk: deviceConfig.productKey,
      deviceName: deviceConfig.deviceName,
      identifier: identifier,
      value: String(value)
    });
    
    console.log('请求URL:', url);
    wx.request({
      url: url,
      method: 'POST',
      header: this.buildHeaders(),
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({
            title: '设置成功',
            icon: 'success'
          });
          // 重新获取设备属性
          this.getDeviceProperties();
        } else {
          wx.showToast({
            title: res.data.message || '设置失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        console.error('设置设备属性失败:', err);
      }
    });
  },

  /**
   * 获取设备的连接状态
   */
  getDeviceStatus() {
    const { token, deviceConfig } = this.data;
    
    const url = this.buildUrl('http://hkapi.tchjjc.com/api/thing/status', {
      token: token,
      pk: deviceConfig.productKey,
      deviceName: deviceConfig.deviceName
    });
    wx.request({
      url: url,
      method: 'POST',
      header: this.buildHeaders(),
      success: (res) => {
        if (res.data.code === 200) {
          const payload = this.extractPayload(res);
          this.setData({
            deviceStatus: (payload && payload.status) || 0
          });
        } else {
          wx.showToast({
            title: res.data.message || '获取设备状态失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('获取设备状态失败:', err);
      }
    });
  },

  /**
   * 批量获取设备的信息
   */
  getDeviceList(status = null) {
    const { token, deviceConfig, currentPage, pageSize } = this.data;
    
    const requestData = {
      token: token,
      pk: deviceConfig.productKey,
      deviceName: deviceConfig.deviceName,
      currentPage: currentPage,
      pageSize: pageSize
    };
    
    if (status !== null) {
      requestData.status = status;
    }
    
    const url = this.buildUrl('http://hkapi.tchjjc.com/api/things/info', requestData);
    wx.request({
      url: url,
      method: 'POST',
      header: this.buildHeaders(),
      success: (res) => {
        // 兼容三种返回：{code:200,data:[...]}, {code:200, items:[...]}, 顶层数组 [...]
        const isArrayTopLevel = Array.isArray(res.data);
        const isOkWrapped = res.data && res.data.code === 200;
        if (isArrayTopLevel || isOkWrapped) {
          const payload = isArrayTopLevel ? res.data : this.extractPayload(res);
          const listRaw = Array.isArray(payload) ? payload : (payload && payload.items) || [];
          // 兜底字段映射，确保渲染字段存在
          const list = listRaw.map((it) => ({
            ...it,
            iotId: it.iotId || `${it.productKey || ''}:${it.name || ''}`,
            gmtModified: it.gmtModified || null
          }));
          const newDeviceList = currentPage === 1 ? list : [...this.data.deviceList, ...list];
            
          this.setData({
            deviceList: newDeviceList,
            totalDevices: (res.data && res.data.total) || newDeviceList.length
          });
        } else {
          wx.showToast({
            title: res.data.message || '获取设备列表失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        console.error('获取设备列表失败:', err);
      },
      complete: () => {
        this.setData({ 
          loading: false,
          refreshing: false 
        });
        wx.stopPullDownRefresh();
      }
    });
  },

  /**
   * 获取设备属性值的历史数据
   */
  getHistoryData() {
    const { token, deviceConfig, historyStartTs, historyEndTs, propertyIdentifier } = this.data;
    
    if (!propertyIdentifier) {
      wx.showToast({
        title: '请选择属性',
        icon: 'none'
      });
      return;
    }
    
    const startTime = historyStartTs;
    const endTime = historyEndTs;
    
    const url = this.buildUrl('http://hkapi.tchjjc.com/api/thing/property/timeline', {
      token: token,
      productKey: deviceConfig.productKey,
      deviceName: deviceConfig.deviceName,
      identifier: propertyIdentifier,
      start: startTime,
      end: endTime,
      pageSize: 200,
      ordered: true
    });
    wx.request({
      url: url,
      method: 'POST',
      header: this.buildHeaders(),
      success: (res) => {
        if (res.data.code === 200) {
          const payload = this.extractPayload(res);
          const items = (payload && payload.items) || (Array.isArray(payload) ? payload : []);
          this.setData({
            historyData: items
          });
        } else {
          wx.showToast({
            title: res.data.message || '获取历史数据失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        console.error('获取历史数据失败:', err);
      }
    });
  },

  // ==================== UI事件处理 ====================

  /**
   * 切换标签页
   */
  onTabChange(e) {
    const index = e.detail.index;
    this.setData({ activeTab: index });
    
    switch (index) {
      case 0: // 设备信息
        this.getDeviceInfo();
        break;
      case 1: // 设备列表
        this.setData({ currentPage: 1 });
        this.getDeviceList();
        break;
      case 2: // 历史数据
        this.getHistoryData();
        break;
    }
  },

  /**
   * 刷新数据
   */
  refreshData() {
    switch (this.data.activeTab) {
      case 0:
        this.getDeviceInfo();
        break;
      case 1:
        this.setData({ currentPage: 1 });
        this.getDeviceList();
        break;
      case 2:
        this.getHistoryData();
        break;
    }
  },

  /**
   * 加载更多设备
   */
  loadMoreDevices() {
    if (this.data.loading) return;
    
    this.setData({ 
      loading: true,
      currentPage: this.data.currentPage + 1 
    });
    this.getDeviceList();
  },

  /**
   * 设置设备属性
   */
  onSetProperty() {
    const { propertyIdentifier, propertyValue } = this.data;
    
    if (!propertyIdentifier || propertyValue === '') {
      wx.showToast({
        title: '请填写完整的属性信息',
        icon: 'none'
      });
      return;
    }
    
    this.setDeviceProperty(propertyIdentifier, propertyValue);
  },

  /**
   * 属性标识符输入
   */
  onPropertyIdentifierInput(e) {
    this.setData({
      propertyIdentifier: e.detail.value
    });
  },

  /**
   * 打开属性选择器
   */
  onOpenPropertySelector() {
    const properties = this.data.templateProperties || [];
    const columns = [properties.map(p => ({ text: `${p.name}(${p.identifier})`, value: p.identifier }))];
    this.setData({
      showPropertyPicker: true,
      propertyPickerColumns: columns
    });
  },

  /**
   * 确认属性选择
   */
  onPropertyConfirm(e) {
    const selected = e.detail && e.detail.value ? e.detail.value[0] : null;
    if (selected) {
      this.setData({
        propertyIdentifier: selected.value,
        showPropertyPicker: false
      });
    }
  },

  /**
   * 取消属性选择
   */
  onPropertyCancel() {
    this.setData({
      showPropertyPicker: false
    });
  },

  /**
   * 属性值输入
   */
  onPropertyValueInput(e) {
    this.setData({
      propertyValue: e.detail.value
    });
  },

  /**
   * 开始时间选择
   */
  onStartTimeChange() {
    this.setData({
      showStartTimePicker: true
    });
  },

  /**
   * 结束时间选择
   */
  onEndTimeChange() {
    this.setData({
      showEndTimePicker: true
    });
  },

  /**
   * 开始时间确认
   */
  onStartTimeConfirm(e) {
    const ts = typeof e.detail === 'number' ? e.detail : (e.detail?.value || e.detail);
    const date = new Date(ts);
    this.setData({
      historyStartTime: this.formatDate(date),
      historyStartTs: date.getTime(),
      showStartTimePicker: false
    });
  },

  /**
   * 结束时间确认
   */
  onEndTimeConfirm(e) {
    const ts = typeof e.detail === 'number' ? e.detail : (e.detail?.value || e.detail);
    const date = new Date(ts);
    this.setData({
      historyEndTime: this.formatDate(date),
      historyEndTs: date.getTime(),
      showEndTimePicker: false
    });
  },

  /**
   * 关闭开始时间选择器
   */
  onStartTimePickerClose() {
    this.setData({
      showStartTimePicker: false
    });
  },

  /**
   * 关闭结束时间选择器
   */
  onEndTimePickerClose() {
    this.setData({
      showEndTimePicker: false
    });
  },

  /**
   * 属性选择
   */
  onPropertySelect(e) {
    this.setData({
      propertyIdentifier: e.detail.value
    });
  },

  /**
   * 查询历史数据
   */
  onQueryHistory() {
    this.getHistoryData();
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  },

  // ==================== 工具方法 ====================

  /**
   * 格式化日期
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 格式化时间戳
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    return this.data.statusTextMap[status] || '未知';
  },

  /**
   * 获取状态颜色
   */
  getStatusColor(status) {
    return this.data.statusColorMap[status] || '#999999';
  },

  /**
   * 统一构建请求头，确保每次请求都带上 token
   */
  buildHeaders() {
    // 仅使用内容类型，不在请求头附加 Authorization，按接口要求通过 body 传递 token
    return { 'Content-Type': 'application/json' };
  },

  /**
   * 兼容不同返回包裹：
   * - { code, data: {...} }
   * - { code, ...payload }
   * - { code, items: [] }
   */
  extractPayload(res) {
    if (!res || !res.data) return null;
    const d = res.data;
    if (d.data !== undefined) return d.data;
    if (d.items !== undefined) return { items: d.items };
    // 去除已知字段后返回剩余作为payload
    const { code, message, localizedMsg, token, expiresIn, total, ...rest } = d;
    const keys = Object.keys(rest || {});
    if (keys.length > 0) return rest;
    return null;
  },

  /**
   * 将参数对象拼接为 querystring 到 url 上
   */
  buildUrl(base, params) {
    const query = Object.keys(params || {})
      .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    return query ? `${base}?${query}` : base;
  },

  /**
   * 发送设备控制命令（form-urlencoded）
   */
  sendControlCommand(identifier, isOn) {
    const { deviceConfig } = this.data;
    const cmd = isOn ? 'turnon' : 'turnoff';
    wx.request({
      url: 'http://hk.tchjjc.com/admin/alidevrealdata/controldev.html',
      method: 'POST',
      header: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: `pk=${encodeURIComponent(deviceConfig.productKey)}&deviceName=${encodeURIComponent(deviceConfig.deviceName)}&identifier=${encodeURIComponent(identifier)}&cmd=${encodeURIComponent(cmd)}`,
      success: (res) => {
        // 可根据返回码做提示
        if (!(res.statusCode >= 200 && res.statusCode < 300)) {
          wx.showToast({ title: '控制失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已下发', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  onToggleChswt1(e) {
    const isOn = e.detail; // van-switch 直接返回布尔
    this.setData({ chswt1On: isOn });
    this.sendControlCommand('CHSWT1', isOn);
  },

  onToggleChswt2(e) {
    const isOn = e.detail;
    this.setData({ chswt2On: isOn });
    this.sendControlCommand('CHSWT2', isOn);
  }
});
