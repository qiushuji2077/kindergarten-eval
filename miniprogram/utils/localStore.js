const { inferAgeBand, matchGuide } = require('./guide');

const KEY = 'kg_local_db_v1';

function nid(len = 10) {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, len);
}

function seed() {
  const classId = 'class-zhong2';
  return {
    classes: [{ id: classId, name: '中二班', child_count: 12, teacher_count: 3 }],
    teachers: [
      { id: 't-yangfei', name: '杨飞', phone: '13800000001', class_id: classId },
      { id: 't-limeihui', name: '李美慧', phone: '13800000002', class_id: classId },
      { id: 't-wang', name: '王老师', phone: '13800000003', class_id: classId },
    ],
    children: [
      { id: 'c-xiaomai', name: '小麦', class_id: classId, class_name: '中二班', gender: '女', birthday: '2021-05-12' },
      { id: 'c-tangguo', name: '小糖果', class_id: classId, class_name: '中二班', gender: '女', birthday: '2021-08-03' },
      { id: 'c-xixi', name: '熙熙', class_id: classId, class_name: '中二班', gender: '男', birthday: '2021-03-21' },
      { id: 'c-zhou', name: '周彦静', class_id: classId, class_name: '中二班', gender: '女', birthday: '2021-11-09' },
      { id: 'c-duoduo', name: '朵朵', class_id: classId, class_name: '中二班', gender: '女', birthday: '2021-09-02' },
      { id: 'c-chenchen', name: '晨晨', class_id: classId, class_name: '中二班', gender: '男', birthday: '2021-06-18' },
      { id: 'c-anan', name: '安安', class_id: classId, class_name: '中二班', gender: '女', birthday: '2021-04-11' },
      { id: 'c-lele', name: '乐乐', class_id: classId, class_name: '中二班', gender: '男', birthday: '2021-07-26' },
      { id: 'c-youyou', name: '悠悠', class_id: classId, class_name: '中二班', gender: '女', birthday: '2021-10-08' },
      { id: 'c-guoguo', name: '果果', class_id: classId, class_name: '中二班', gender: '女', birthday: '2021-12-01' },
      { id: 'c-xuanxuan', name: '轩轩', class_id: classId, class_name: '中二班', gender: '男', birthday: '2021-02-19' },
      { id: 'c-nuonuo', name: '诺诺', class_id: classId, class_name: '中二班', gender: '女', birthday: '2021-08-22' },
    ],
    observations: [],
  };
}

function load() {
  const cached = wx.getStorageSync(KEY);
  if (cached && cached.classes) return cached;
  const db = seed();
  wx.setStorageSync(KEY, db);
  return db;
}

function save(db) {
  wx.setStorageSync(KEY, db);
}

function handle(action, payload = {}) {
  const db = load();
  if (action === 'classes') return Promise.resolve(db.classes);
  if (action === 'teachers') {
    const list = payload.classId ? db.teachers.filter((t) => t.class_id === payload.classId) : db.teachers;
    return Promise.resolve(list);
  }
  if (action === 'children') {
    const list = payload.classId ? db.children.filter((c) => c.class_id === payload.classId) : db.children;
    return Promise.resolve(list);
  }
  if (action === 'createChild') {
    const name = String(payload.name || '').trim();
    if (!name || !payload.classId) return Promise.reject(new Error('幼儿姓名和班级必填'));
    const cls = db.classes.find((c) => c.id === payload.classId);
    const child = {
      id: nid(10),
      name,
      class_id: payload.classId,
      class_name: cls ? cls.name : '',
      gender: payload.gender || '女',
      birthday: payload.birthday || '',
    };
    db.children.push(child);
    save(db);
    return Promise.resolve(child);
  }
  if (action === 'matchGuide') {
    const cls = db.classes.find((c) => c.id === payload.classId);
    const child = payload.childIds && payload.childIds[0]
      ? db.children.find((c) => c.id === payload.childIds[0])
      : null;
    const ageBand = inferAgeBand({
      className: cls && cls.name,
      birthday: child && child.birthday,
      observedAt: payload.observedAt,
    });
    return Promise.resolve({
      ageBand,
      hits: matchGuide(payload.text, ageBand).map((h) => Object.assign({}, h, { source: 'rule' })),
      interpret: '',
      source: 'rule',
    });
  }
  if (action === 'observations') {
    let rows = db.observations.slice();
    if (payload.classId) rows = rows.filter((o) => o.class_id === payload.classId);
    if (payload.teacherId) rows = rows.filter((o) => o.teacher_id === payload.teacherId);
    if (payload.childId) {
      rows = rows.filter((o) => (o.children || []).some((c) => c.id === payload.childId));
    }
    rows.sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)));
    return Promise.resolve(rows.slice(0, Number(payload.limit) || 80));
  }
  if (action === 'createObservation') {
    const childIds = payload.childIds || [];
    if (!payload.teacherId || !payload.classId || !payload.observedAt) {
      return Promise.reject(new Error('缺少必要字段'));
    }
    if (!childIds.length) return Promise.reject(new Error('请至少指定一名幼儿'));
    const teacher = db.teachers.find((t) => t.id === payload.teacherId);
    const cls = db.classes.find((c) => c.id === payload.classId);
    const kids = childIds.map((id) => {
      const hit = db.children.find((c) => c.id === id);
      return hit || { id, name: '幼儿', class_id: payload.classId, class_name: cls ? cls.name : '' };
    });
    const ageBand = inferAgeBand({
      className: cls && cls.name,
      birthday: kids[0] && kids[0].birthday,
      observedAt: payload.observedAt,
    });
    const hits =
      payload.guideHits && payload.guideHits.length
        ? payload.guideHits
        : matchGuide(`${payload.narrative || ''}\n${payload.voiceTranscript || ''}`, ageBand);
    const row = {
      id: payload.id || nid(12),
      teacher_id: payload.teacherId,
      teacher_name: teacher ? teacher.name : '',
      class_id: payload.classId,
      class_name: cls ? cls.name : '',
      record_type: 'COA记录',
      observed_at: payload.observedAt,
      narrative: payload.narrative || '',
      voice_transcript: payload.voiceTranscript || '',
      children: kids,
      media: [],
      guideHits: hits,
      interpret: payload.interpret || '',
      stages: [],
    };
    db.observations.unshift(row);
    save(db);
    return Promise.resolve(row);
  }
  if (action === 'addMedia') {
    const obs = db.observations.find((o) => o.id === payload.observationId);
    if (!obs) return Promise.reject(new Error('记录不存在'));
    obs.media = obs.media || [];
    obs.media.push({
      id: nid(12),
      kind: payload.kind || 'photo',
      filename: payload.fileID || payload.path || '',
      fileID: payload.fileID || payload.path || '',
    });
    save(db);
    return Promise.resolve(obs);
  }
  if (action === 'updateObservation') {
    const obs = db.observations.find((o) => o.id === payload.id);
    if (!obs) return Promise.reject(new Error('记录不存在'));
    if (payload.narrative !== undefined) obs.narrative = payload.narrative;
    if (payload.voiceTranscript !== undefined) obs.voice_transcript = payload.voiceTranscript;
    if (payload.guideHits) obs.guideHits = payload.guideHits;
    if (payload.interpret !== undefined) obs.interpret = payload.interpret;
    if (payload.media) obs.media = payload.media;
    save(db);
    return Promise.resolve(obs);
  }
  if (action === 'reportDocx' || action === 'reportText') {
    const child = db.children.find((c) => c.id === payload.childId);
    if (!child) return Promise.reject(new Error('幼儿不存在'));
    const rows = db.observations.filter((o) => (o.children || []).some((c) => c.id === child.id));
    const lines = [
      String(payload.kindergartenName || '').trim() || '幼儿园',
      '儿童观察记录汇总',
      `儿童姓名：${child.name}`,
      `班级名称：${child.class_name || ''}`,
      `共 ${rows.length} 条`,
      '',
    ];
    rows.forEach((o, i) => {
      lines.push(`【${i + 1}】${String(o.observed_at || '').slice(0, 16)} ${o.teacher_name || ''}`);
      lines.push(o.narrative || '（无文字实录）');
      (o.guideHits || []).forEach((g) => {
        lines.push(`《指南》${g.domain} ${g.goal}`);
      });
      lines.push('');
    });
    if (action === 'reportText') {
      return Promise.resolve({ text: lines.join('\n'), filename: `${child.name}-观察记录.txt` });
    }
    return Promise.reject(new Error('Word 正在生成。若未打开，可先复制文字稿'));
  }
  if (action === 'summarize') {
    return Promise.resolve({ interpret: '' });
  }
  return Promise.reject(new Error(`未知操作 ${action || ''}`));
}

function upsertObservation(row) {
  if (!row || !row.id) return;
  const db = load();
  const i = db.observations.findIndex((o) => o.id === row.id);
  if (i >= 0) db.observations[i] = Object.assign({}, db.observations[i], row);
  else db.observations.unshift(row);
  save(db);
}

module.exports = { handle, upsertObservation };
