const { request, downloadReport } = require('../../utils/api');
const { ensureSession } = require('../../utils/session');

const OPEN_HINT = '点幼儿姓名后会打开文件。打开后点右上角 ···，发给「文件传输助手」或存到手机。';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Page({
  data: {
    list: [],
    error: '',
    kindergartenName: '',
    hint: OPEN_HINT,
    busy: false,
    phase: '',
    busyTitle: '',
    busySub: '',
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
  setPhase(phase, extra) {
    const copy = {
      collect: ['正在整理观察', '先把这个孩子的记录收齐'],
      summarize: ['正在写发展综述', '根据观察实录生成一段话'],
      aiDone: ['发展综述已写好', '接下来生成 Word'],
      write: ['正在生成 Word', extra && extra.usedAi ? '综述写好了，正在装进文件' : '把观察记录汇总成文档'],
    };
    const pair = copy[phase] || copy.write;
    this.setData({
      busy: true,
      phase,
      busyTitle: pair[0],
      busySub: pair[1],
    });
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
    if (this.data.busy) return;
    const { id, name } = e.currentTarget.dataset;
    this.exporting = true;
    this.setPhase('collect');
    downloadReport(id, name, (phase, extra) => {
      if (!this.exporting) return;
      this.setPhase(phase, extra);
    })
      .then(async (res) => {
        const filePath = res && res.filePath ? res.filePath : res;
        const usedAi = !!(res && res.usedAi);
        if (usedAi && this.data.phase !== 'aiDone') {
          this.setPhase('aiDone', { usedAi: true });
          await wait(1200);
        } else if (usedAi) {
          await wait(900);
        }
        this.exporting = false;
        this.setData({ busy: false, phase: '', error: '' });
        this.openReport(filePath, name);
      })
      .catch((err) => {
        this.exporting = false;
        this.setData({
          busy: false,
          phase: '',
          error: (err && err.message) || '导出失败',
        });
      });
  },
  logout() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
});
