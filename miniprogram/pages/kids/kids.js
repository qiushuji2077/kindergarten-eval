const { request } = require('../../utils/api');
const { ensureSession } = require('../../utils/session');

Page({
  data: { list: [], className: '', name: '', error: '' },
  onShow() {
    ensureSession()
      .then((session) => {
        this.session = session;
        this.setData({ className: session.className });
        this.load();
      })
      .catch((e) => this.setData({ error: e.message }));
  },
  load() {
    request(`/api/children?classId=${this.session.classId}`).then((list) => this.setData({ list }));
  },
  onName(e) {
    this.setData({ name: e.detail.value });
  },
  add() {
    const name = (this.data.name || '').trim();
    if (!name) return;
    request('/api/children', 'POST', { name, classId: this.session.classId, gender: '女' })
      .then(() => {
        this.setData({ name: '', error: '' });
        this.load();
      })
      .catch((e) => this.setData({ error: e.message }));
  },
});
