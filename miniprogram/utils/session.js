const { request } = require('./api');

function readSession() {
  return wx.getStorageSync('session') || (getApp().globalData && getApp().globalData.session) || null;
}

function writeSession(session) {
  wx.setStorageSync('session', session);
  const app = getApp();
  if (app && app.globalData) app.globalData.session = session;
  return session;
}

function pickPreferred(list, name, fallbackId) {
  return (list || []).find((x) => x.name === name)
    || (list || []).find((x) => x.id === fallbackId)
    || (list || [])[0]
    || null;
}

function ensureSession() {
  const existing = readSession();
  if (existing && existing.teacherId && existing.classId) {
    return Promise.resolve(existing);
  }
  return Promise.all([request('/api/classes'), request('/api/teachers')]).then(([classes, teachers]) => {
    const cls = pickPreferred(classes, '中二班', 'class-zhong2');
    const classTeachers = (teachers || []).filter((t) => !cls || t.class_id === cls.id);
    const teacher = pickPreferred(classTeachers.length ? classTeachers : teachers, '杨飞', 't-yangfei');
    if (!cls || !teacher) throw new Error('没有可用的班级或教师');
    return writeSession({
      classId: cls.id,
      className: cls.name,
      teacherId: teacher.id,
      teacherName: teacher.name,
      kindergartenName: wx.getStorageSync('kindergartenName') || '',
    });
  });
}

module.exports = {
  ensureSession,
  readSession,
  writeSession,
};
