const { request } = require('../../utils/api');
const { writeSession } = require('../../utils/session');

Page({
  data: {
    classes: [],
    teachers: [],
    classId: '',
    teacherId: '',
    kindergartenName: '',
    error: '',
  },
  onLoad() {
    const lastKg = wx.getStorageSync('kindergartenName') || '';
    const session = wx.getStorageSync('session') || {};
    this.setData({
      kindergartenName: lastKg || session.kindergartenName || '',
      classId: session.classId || '',
      teacherId: session.teacherId || '',
    });
    this.load();
  },
  load() {
    Promise.all([request('/api/classes'), request('/api/teachers')])
      .then(([classes, teachers]) => {
        const classId = this.data.classId || (classes[0] ? classes[0].id : '');
        const classTeachers = teachers.filter((t) => !classId || t.class_id === classId);
        const teacherId =
          (classTeachers.find((t) => t.id === this.data.teacherId) || classTeachers[0] || {}).id || '';
        this.setData({
          classes,
          allTeachers: teachers,
          teachers: classTeachers,
          classId,
          teacherId,
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
    const cls = this.data.classes.find((c) => c.id === this.data.classId);
    const teacher = (this.data.allTeachers || this.data.teachers).find(
      (t) => t.id === this.data.teacherId,
    );
    if (!cls || !teacher) {
      this.setData({ error: '请先选择班级和教师' });
      return;
    }
    const kindergartenName = String(this.data.kindergartenName || '').trim();
    const session = {
      classId: cls.id,
      className: cls.name,
      teacherId: teacher.id,
      teacherName: teacher.name,
      kindergartenName,
    };
    writeSession(session);
    wx.setStorageSync('kindergartenName', kindergartenName);
    wx.switchTab({ url: '/pages/feed/feed' });
  },
});
