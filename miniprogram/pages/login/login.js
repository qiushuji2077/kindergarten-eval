const { request } = require('../../utils/api');

Page({
  data: {
    classes: [],
    teachers: [],
    classId: '',
    teacherId: '',
    kindergartenName: '',
    error: '',
    agreed: false,
  },
  onLoad() {
    const lastKg = wx.getStorageSync('kindergartenName') || '';
    const agreed = !!wx.getStorageSync('privacyAgreed');
    this.setData({ kindergartenName: lastKg, agreed });
    const session = wx.getStorageSync('session');
    if (session && session.teacherId && agreed) {
      wx.switchTab({ url: '/pages/feed/feed' });
      return;
    }
    this.load();
  },
  load() {
    Promise.all([request('/api/classes'), request('/api/teachers')])
      .then(([classes, teachers]) => {
        const classId = classes[0] ? classes[0].id : '';
        const classTeachers = teachers.filter((t) => !classId || t.class_id === classId);
        this.setData({
          classes,
          allTeachers: teachers,
          teachers: classTeachers,
          classId,
          teacherId: classTeachers[0] ? classTeachers[0].id : '',
        });
      })
      .catch((e) => this.setData({ error: e.message }));
  },
  onKgName(e) {
    this.setData({ kindergartenName: e.detail.value });
  },
  pickClass(e) {
    const classId = e.currentTarget.dataset.id;
    const classTeachers = (this.data.allTeachers || []).filter((t) => t.class_id === classId);
    this.setData({
      classId,
      teachers: classTeachers,
      teacherId: classTeachers[0] ? classTeachers[0].id : '',
    });
  },
  pickTeacher(e) {
    this.setData({ teacherId: e.currentTarget.dataset.id });
  },
  toggleAgree() {
    const agreed = !this.data.agreed;
    this.setData({ agreed, error: '' });
    wx.setStorageSync('privacyAgreed', agreed);
  },
  openPrivacy() {
    wx.navigateTo({ url: '/pages/legal/privacy' });
  },
  openTerms() {
    wx.navigateTo({ url: '/pages/legal/terms' });
  },
  openAbout() {
    wx.navigateTo({ url: '/pages/about/about' });
  },
  enter() {
    if (!this.data.agreed) {
      this.setData({ error: '请先阅读并同意隐私保护指引' });
      return;
    }
    const cls = this.data.classes.find((c) => c.id === this.data.classId);
    const teacher = (this.data.allTeachers || this.data.teachers).find(
      (t) => t.id === this.data.teacherId,
    );
    if (!cls || !teacher) return;
    const kindergartenName = String(this.data.kindergartenName || '').trim();
    const session = {
      classId: cls.id,
      className: cls.name,
      teacherId: teacher.id,
      teacherName: teacher.name,
      kindergartenName,
    };
    wx.setStorageSync('session', session);
    wx.setStorageSync('kindergartenName', kindergartenName);
    wx.setStorageSync('privacyAgreed', true);
    getApp().globalData.session = session;
    wx.switchTab({ url: '/pages/feed/feed' });
  },
});
