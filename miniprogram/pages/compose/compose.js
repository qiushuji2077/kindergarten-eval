const { request, uploadMedia, persistFiles } = require('../../utils/api');
const localStore = require('../../utils/localStore');
const { clockLabel, clockLabelFromIso, isoLocal } = require('../../utils/clock');
const privacy = require('../../utils/privacy');

function authLabel(v) {
  if (v === true) return '已开';
  if (v === false) return '已关';
  return '未问';
}

function canPostOf(kids, narrative, files) {
  const hasKid = (kids || []).some((k) => k.on);
  return hasKid && (!!String(narrative || '').trim() || (files || []).length > 0);
}

function formatHits(hits) {
  return (hits || []).map((h) => ({
    ...h,
    keywordText: (h.keywords || []).join('、'),
    sourceLabel: h.source === 'ai' ? 'AI' : '字段',
  }));
}

function matchTitleOf(source, ageBand) {
  return `${source === 'ai' ? 'AI 对应指南' : '指南对应'} · ${ageBand || '4-5岁'}`;
}

Page({
  data: {
    narrative: '',
    kids: [],
    files: [],
    hits: [],
    ageBand: '4-5岁',
    listening: false,
    error: '',
    hint: '发表前请点选幼儿。点输入框后，也可用键盘上的微信语音。',
    canPost: false,
    clock: '',
    editing: false,
    frozen: false,
    submitText: '发表',
    interpret: '',
    matchTitle: '指南对应',
    source: '',
    showPrivacy: false,
    privacyContractName: '《用户隐私保护指引》',
  },
  onLoad(options) {
    this.session = wx.getStorageSync('session');
    if (!this.session) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.editId = (options && options.id) || '';
    this.frozenAt = '';
    this.frozenChildIds = [];
    this.setData({ clock: clockLabel() });
    privacy.bindPrivacyAuthorization(this);
    request(`/api/children?classId=${this.session.classId}`)
      .then((list) => {
        this.patch({ kids: (list || []).map((k) => ({ ...k, on: false })) });
        if (this.editId) this.loadEdit(this.editId);
      })
      .catch((e) => this.setData({ error: e.message }));
  },
  onShow() {
    if (this.editId) {
      if (this.frozenAt) this.setData({ clock: clockLabelFromIso(this.frozenAt) });
      return;
    }
    this.setData({ clock: clockLabel() });
    this.clockTimer = setInterval(() => this.setData({ clock: clockLabel() }), 1000);
  },
  onHide() {
    clearInterval(this.clockTimer);
  },
  onUnload() {
    clearInterval(this.clockTimer);
    this.stopVoice(true);
    privacy.unbindPrivacyAuthorization(this);
  },
  patch(fields) {
    const next = Object.assign({}, fields);
    const kids = next.kids !== undefined ? next.kids : this.data.kids;
    const narrative = next.narrative !== undefined ? next.narrative : this.data.narrative;
    const files = next.files !== undefined ? next.files : this.data.files;
    const hasKid = this.editId
      ? (this.frozenChildIds || []).length > 0 || (kids || []).some((k) => k.on)
      : (kids || []).some((k) => k.on);
    next.canPost = hasKid && (!!String(narrative || '').trim() || (files || []).length > 0);
    this.setData(next);
  },
  loadEdit(id) {
    const cached = wx.getStorageSync('editingObs');
    request(`/api/observations?classId=${this.session.classId}&limit=80`)
      .then((list) => {
        const obs = (list || []).find((o) => o.id === id) || cached;
        if (!obs || obs.id !== id) {
          this.setData({ error: '没找到这条记录' });
          return;
        }
        this.applyObs(obs);
      })
      .catch(() => {
        if (cached && cached.id === id) this.applyObs(cached);
        else this.setData({ error: '没找到这条记录' });
      });
  },
  applyObs(obs) {
    this.editId = obs.id;
    this.frozenAt = obs.observed_at;
    this.frozenChildIds = (obs.children || []).map((c) => c.id).filter(Boolean);
    const selected = {};
    this.frozenChildIds.forEach((cid) => {
      selected[cid] = true;
    });
    const kids = (this.data.kids || []).map((k) => ({ ...k, on: !!selected[k.id] }));
    const files = (obs.media || [])
      .map((m, i) => ({
        id: m.id || `old-${i}`,
        path: m.path || m.fileID || m.filename || '',
        kind: m.kind || 'photo',
        existing: true,
      }))
      .filter((f) => f.path);
    wx.setNavigationBarTitle({ title: '改观察' });
    this.patch({
      editing: true,
      frozen: true,
      submitText: '保存',
      hint: '观察时间已冻结，不能改。可以改文字、补照片。',
      clock: clockLabelFromIso(obs.observed_at),
      narrative: obs.narrative || obs.voice_transcript || '',
      kids,
      files,
      hits: formatHits(obs.guideHits || []),
      interpret: obs.interpret || '',
      source: (obs.guideHits || []).some((h) => h.source === 'ai') ? 'ai' : '',
      matchTitle: matchTitleOf(
        (obs.guideHits || []).some((h) => h.source === 'ai') ? 'ai' : '',
        this.data.ageBand,
      ),
      error: '',
    });
    if (this.data.narrative) this.match();
  },
  onText(e) {
    this.patch({ narrative: e.detail.value, error: '' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.match(), 400);
  },
  selectedIds() {
    return this.data.kids.filter((k) => k.on).map((k) => k.id);
  },
  toggleKid(e) {
    if (this.editId) return;
    const id = e.currentTarget.dataset.id;
    const kids = this.data.kids.map((k) => (k.id === id ? { ...k, on: !k.on } : k));
    this.patch({ kids, error: '' });
    this.match();
  },
  match() {
    const text = this.data.narrative.trim();
    if (!text) {
      this.setData({ hits: [], interpret: '', source: '', matchTitle: matchTitleOf('', this.data.ageBand) });
      return;
    }
    request('/api/guide/match', 'POST', {
      text,
      classId: this.session.classId,
      childIds: this.editId ? this.frozenChildIds : this.selectedIds(),
      observedAt: this.frozenAt || isoLocal(),
    })
      .then((r) => {
        this.setData({
          ageBand: r.ageBand,
          hits: formatHits(r.hits),
          interpret: r.interpret || '',
          source: r.source || '',
          matchTitle: matchTitleOf(r.source, r.ageBand),
        });
      })
      .catch(() => {});
  },
  addTempFiles(tempFiles) {
    const extra = (tempFiles || []).map((f, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      path: f.tempFilePath,
      kind: f.fileType === 'video' ? 'video' : 'photo',
    }));
    this.patch({ files: this.data.files.concat(extra).slice(0, 9), error: '' });
  },
  removeFile(e) {
    const id = e.currentTarget.dataset.id;
    this.patch({ files: this.data.files.filter((f) => f.id !== id), error: '' });
  },
  hintIfDenied(msg, scope) {
    if (!/auth deny|authorize|privacy|permission|未授权|隐私/i.test(msg)) return;
    wx.getSetting({
      success: (s) => {
        const cam = authLabel(s.authSetting['scope.camera']);
        const rec = authLabel(s.authSetting['scope.record']);
        this.setData({ error: `${msg}（相机${cam} 麦克风${rec}）` });
        if (s.authSetting[scope] === false) {
          wx.showModal({
            title: '没有权限',
            content: '请点「去设置」打开麦克风。',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting();
            },
          });
        }
      },
    });
  },
  chooseShot() {
    privacy
      .ensurePrivacyAuthorized(this)
      .then(() => {
        wx.chooseMedia({
          count: 9 - this.data.files.length,
          mediaType: ['image', 'video'],
          sourceType: ['camera', 'album'],
          maxDuration: 60,
          camera: 'back',
          success: (res) => this.addTempFiles(res.tempFiles),
          fail: (err) => {
            const msg = err.errMsg || '没打开相机或相册';
            if (/cancel/i.test(msg)) return;
            this.setData({ error: msg });
            this.hintIfDenied(msg, 'scope.camera');
          },
        });
      })
      .catch((e) => this.setData({ error: e.message || '需要同意隐私保护指引后才能拍照' }));
  },
  voiceMove() {},
  voiceStart() {
    if (this.data.listening) return;
    privacy
      .ensurePrivacyAuthorized(this)
      .then(() => {
        this.voiceOn = true;
        this.setData({ listening: true, error: '' });
        wx.startRecord({
          success: () => {
            this.voiceEngine = 'wx';
          },
          fail: (err) => {
            const msg = (err && err.errMsg) || '';
            if (/cancel/i.test(msg)) {
              this.voiceOn = false;
              this.setData({ listening: false });
              return;
            }
            this.startRecorderFallback(msg);
          },
        });
      })
      .catch((e) => this.setData({ error: e.message || '需要同意隐私保护指引后才能录音' }));
  },
  startRecorderFallback(reason) {
    if (!this.recorder) {
      this.recorder = wx.getRecorderManager();
      this.recorder.onStop((res) => this.afterVoiceFile(res.tempFilePath, false));
      this.recorder.onError((err) => {
        this.voiceOn = false;
        const msg = (err && err.errMsg) || reason || '请允许使用麦克风';
        this.setData({ listening: false, error: msg });
        this.hintIfDenied(msg, 'scope.record');
      });
    }
    this.voiceEngine = 'manager';
    this.recorder.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
    });
  },
  voiceEnd() {
    if (!this.voiceOn && !this.data.listening) return;
    this.stopVoice(false);
  },
  stopVoice(silent) {
    this.voiceOn = false;
    if (this.voiceEngine === 'manager' && this.recorder) {
      this.recorder.stop();
      this.voiceEngine = '';
      if (silent) this.setData({ listening: false });
      return;
    }
    wx.stopRecord({
      success: (res) => {
        this.voiceEngine = '';
        if (silent) {
          this.setData({ listening: false });
          return;
        }
        this.afterVoiceFile(res.tempFilePath, true);
      },
      fail: () => {
        this.voiceEngine = '';
        this.setData({ listening: false });
      },
    });
  },
  afterVoiceFile(filePath, canTranslate) {
    if (!filePath) {
      this.setData({ listening: false });
      return;
    }
    const files = this.data.files.concat([
      { id: `a-${Date.now()}`, path: filePath, kind: 'audio' },
    ]).slice(0, 9);
    this.patch({ files, listening: false });
    if (!canTranslate || !wx.translateVoice) {
      this.setData({ error: '语音已记下。也可点输入框，用键盘上的微信语音转成文字。' });
      return;
    }
    wx.translateVoice({
      filePath,
      success: (r) => {
        const extra = String(r.translateResult || '').trim();
        if (!extra) {
          this.setData({ error: '没听清。请再按住说一次，或点输入框用键盘语音。' });
          return;
        }
        const narrative = [this.data.narrative, extra].filter(Boolean).join('');
        this.patch({ narrative, error: '' });
        this.match();
      },
      fail: () => {
        this.setData({ error: '语音已记下。点输入框后，可用键盘上的微信语音直接转成文字。' });
      },
    });
  },
  submit() {
    if (this.data.listening) {
      this.setData({ error: '请先松开「按住说话」' });
      return;
    }
    if (!this.editId && !this.selectedIds().length) {
      this.setData({ error: '请先点选观察对象，再发表' });
      return;
    }
    if (this.editId && !(this.frozenChildIds || []).length && !this.selectedIds().length) {
      this.setData({ error: '这条记录没有观察对象，无法保存' });
      return;
    }
    if (!this.data.narrative.trim() && !this.data.files.length) {
      this.setData({ error: '请写一句实录，或加一张照片' });
      return;
    }
    const observedAt = this.frozenAt || isoLocal();
    const files = this.data.files.slice();
    const hits = this.data.hits || [];
    const narrative = this.data.narrative.trim();
    const existing = files.filter((f) => f.existing);
    const fresh = files.filter((f) => !f.existing);
    wx.showLoading({ title: this.editId ? '保存中' : '发布中', mask: true });
    persistFiles(fresh)
      .then((saved) => {
        const allFiles = existing.concat(saved);
        const media = allFiles.map((f) => ({
          id: f.id,
          kind: f.kind,
          filename: f.path,
          fileID: f.path,
          path: f.path,
        }));
        if (this.editId) {
          return request('/api/observations/update', 'POST', {
            id: this.editId,
            narrative,
            guideHits: hits,
            interpret: this.data.interpret || '',
            media,
          }).then((obs) => ({ obs, saved, media }));
        }
        return request('/api/observations/text', 'POST', {
          teacherId: this.session.teacherId,
          classId: this.session.classId,
          observedAt,
          narrative,
          childIds: this.selectedIds(),
          guideHits: hits,
          interpret: this.data.interpret || '',
        }).then((obs) => ({ obs, saved, media }));
      })
      .then(({ obs, saved, media }) => {
        const next = Object.assign({}, obs, {
          observed_at: this.frozenAt || obs.observed_at,
          narrative,
          guideHits: hits.length ? hits : obs.guideHits,
          interpret: this.data.interpret || obs.interpret || '',
        });
        if (media) next.media = media;
        localStore.upsertObservation(next);
        const jobs = saved.map((f) => uploadMedia(obs.id, f.path).catch(() => null));
        return Promise.all(jobs);
      })
      .then(() => {
        wx.hideLoading();
        wx.removeStorageSync('editingObs');
        wx.showToast({ title: this.editId ? '已保存' : '已发表', icon: 'success', duration: 800 });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch((e) => {
        wx.hideLoading();
        this.setData({ error: e.message || (this.editId ? '保存失败，请再试一次' : '发表失败，请再试一次') });
      });
  },
  onAgreePrivacy() {
    privacy.finishPrivacyAuthorization(this, true);
  },
  onDisagreePrivacy() {
    privacy.finishPrivacyAuthorization(this, false);
  },
  openPrivacyDoc() {
    privacy.openPrivacyContract();
  },
});
