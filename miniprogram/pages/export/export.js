const { request, downloadReport } = require('../../utils/api');
const { ensureSession } = require('../../utils/session');

const OPEN_HINT = '点幼儿姓名后会打开文件。打开后点右上角 ···，发给「文件传输助手」或存到手机。';

Page({
  data: {
    list: [],
    error: '',
    kindergartenName: '',
    hint: OPEN_HINT,
  },
  onShow() {
    ensureSession()
      .then((session) => {
        this.session = session;
        this.setData({
          kindergartenName: session.kindergartenName || '',
        });
        return request(`/api/children?classId=${session.classId}`);
      })
      .then((list) => this.setData({ list, error: '' }))
      .catch((e) => this.setData({ error: e.message }));
  },
  onKgName(e) {
    const kindergartenName = e.detail.value;
    this.setData({ kindergartenName });
    const session = Object.assign({}, this.session || {}, { kindergartenName });
    this.session = session;
    wx.setStorageSync('session', session);
    wx.setStorageSync('kindergartenName', kindergartenName);
    getApp().globalData.session = session;
  },
  openReport(filePath, name) {
    wx.openDocument({
      filePath,
          fileType: 'docx',
      showMenu: true,
      success: () => {
        wx.showToast({
          title: '打开后点右上角···发给文件传输助手',
          icon: 'none',
          duration: 3500,
        });
      },
      fail: (err) => {
        if (wx.shareFileMessage) {
          wx.shareFileMessage({
            filePath,
            fileName: `${name}-观察记录汇总.docx`,
            fail: () => {
              this.setData({ error: (err && err.errMsg) || '文件已生成，但没能打开。请再点一次姓名。' });
            },
          });
          return;
        }
        this.setData({ error: (err && err.errMsg) || '文件已生成，但没能打开。请再点一次姓名。' });
      },
    });
  },
  exportChild(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showLoading({ title: '生成中' });
    downloadReport(id, name)
      .then((filePath) => {
        wx.hideLoading();
        this.setData({ error: '' });
        wx.showModal({
          title: '请打开文件',
          content: OPEN_HINT,
          confirmText: '打开文件',
          showCancel: false,
          success: () => this.openReport(filePath, name),
        });
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ error: (err && err.message) || '导出失败' });
      });
  },
  logout() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
});
