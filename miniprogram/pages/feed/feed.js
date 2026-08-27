const { request, mediaUrl } = require('../../utils/api');

function dateLabel(iso) {
  const key = iso.slice(0, 10);
  const [y, m, d] = key.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

Page({
  data: { q: '', loading: true, groups: [], kindergartenName: '', kgHint: '' },
  onShow() {
    const session = wx.getStorageSync('session');
    if (!session) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.session = session;
    const kindergartenName = session.kindergartenName || wx.getStorageSync('kindergartenName') || '';
    this.setData({
      kindergartenName,
      kgHint: kindergartenName ? kindergartenName : '未填写园所名称，报告封面只写「幼儿园」',
    });
    this.load();
  },
  onSearch(e) {
    this.setData({ q: e.detail.value });
    this.render(this.raw || []);
  },
  goCompose() {
    wx.removeStorageSync('editingObs');
    wx.navigateTo({ url: '/pages/compose/compose' });
  },
  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const obs = (this.raw || []).find((o) => o.id === id);
    if (obs) wx.setStorageSync('editingObs', obs);
    wx.navigateTo({ url: `/pages/compose/compose?id=${id}` });
  },
  load() {
    this.setData({ loading: true });
    request(`/api/observations?classId=${this.session.classId}&limit=80`)
      .then((list) => {
        this.raw = list;
        this.render(list);
      })
      .catch(() => this.setData({ loading: false, groups: [] }));
  },
  render(list) {
    const q = (this.data.q || '').trim();
    const mapped = list
      .map((obs) => {
        const childNames = (obs.children || []).map((c) => c.name).join('、') || '未指定';
        const excerpt = (obs.narrative || obs.voice_transcript || '').replace(/\s+/g, ' ');
        const g = (obs.guideHits || [])[0];
        const stage = (obs.stages || [])[0];
        const media = (obs.media || []).find((m) => m.kind === 'photo' || m.kind === 'video');
        return {
          ...obs,
          childNames,
          excerpt: excerpt || '无文字实录',
          meta: g
            ? `${obs.teacher_name} · ${g.source === 'ai' ? 'AI · ' : ''}${g.domain}·${g.goal}`
            : `${obs.teacher_name}${stage ? ` · ${stage.indicator_name}` : ''}`,
          thumb: media ? mediaUrl(media.fileID || media.filename || media.path) : '',
        };
      })
      .filter((obs) => !q || `${obs.childNames}${obs.excerpt}${obs.teacher_name}`.includes(q));
    const map = {};
    mapped.forEach((obs) => {
      const key = obs.observed_at.slice(0, 10);
      if (!map[key]) map[key] = { key, label: dateLabel(obs.observed_at), items: [] };
      map[key].items.push(obs);
    });
    this.setData({ loading: false, groups: Object.values(map) });
  },
});
