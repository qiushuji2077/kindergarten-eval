const cloud = require('wx-server-sdk');
const { inferAgeBand, matchGuide } = require('./guide');
const { buildChildReport } = require('./report');
const { aiMatch, aiSummarize } = require('./ai');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COL = {
  classes: 'kg_classes',
  teachers: 'kg_teachers',
  children: 'kg_children',
  observations: 'kg_observations',
};

function nid(len = 12) {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, len);
}

function nowText() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function withId(doc) {
  if (!doc) return doc;
  return { ...doc, id: doc.id || doc._id };
}

async function renameDemoChild() {
  try {
    await db.collection(COL.children).doc('c-xiaomai').update({
      data: { name: '小童' },
    });
  } catch {
    // 库里还没有这条时忽略
  }
}

async function ensureSeed() {
  try {
    const count = await db.collection(COL.classes).count();
    if (count.total > 0) {
      await renameDemoChild();
      return;
    }
  } catch {
    // collection 尚未创建时继续写入
  }
  const classId = 'class-zhong2';
  await db.collection(COL.classes).doc(classId).set({
    data: { name: '中二班', created_at: nowText() },
  });
  const teachers = [
    ['t-yangfei', '杨飞', '13800000001'],
    ['t-limeihui', '李美慧', '13800000002'],
    ['t-wang', '王老师', '13800000003'],
  ];
  for (const [id, name, phone] of teachers) {
    await db.collection(COL.teachers).doc(id).set({
      data: { name, phone, class_id: classId, created_at: nowText() },
    });
  }
  const kids = [
    ['c-xiaomai', '小童', '女', '2021-05-12'],
    ['c-tangguo', '小糖果', '女', '2021-08-03'],
    ['c-xixi', '熙熙', '男', '2021-03-21'],
    ['c-zhou', '周彦静', '女', '2021-11-09'],
    ['c-duoduo', '朵朵', '女', '2021-09-02'],
    ['c-chenchen', '晨晨', '男', '2021-06-18'],
    ['c-anan', '安安', '女', '2021-04-11'],
    ['c-lele', '乐乐', '男', '2021-07-26'],
    ['c-youyou', '悠悠', '女', '2021-10-08'],
    ['c-guoguo', '果果', '女', '2021-12-01'],
    ['c-xuanxuan', '轩轩', '男', '2021-02-19'],
    ['c-nuonuo', '诺诺', '女', '2021-08-22'],
  ];
  for (const [id, name, gender, birthday] of kids) {
    await db.collection(COL.children).doc(id).set({
      data: { name, class_id: classId, gender, birthday, created_at: nowText() },
    });
  }
}

async function getDoc(collection, id) {
  if (!id) return null;
  try {
    const res = await db.collection(collection).doc(id).get();
    return res.data;
  } catch {
    return null;
  }
}

async function getClass(id) {
  return getDoc(COL.classes, id);
}

async function getTeacher(id) {
  return getDoc(COL.teachers, id);
}

async function getChild(id) {
  return getDoc(COL.children, id);
}

async function listBy(collection, where = {}) {
  const res = Object.keys(where).length
    ? await db.collection(collection).where(where).limit(100).get()
    : await db.collection(collection).limit(100).get();
  return (res.data || []).map(withId);
}

async function handle(event) {
  await ensureSeed();
  const action = event.action;
  const classId = event.classId;

  if (action === 'classes') {
    const list = await listBy(COL.classes);
    const children = await listBy(COL.children);
    const teachers = await listBy(COL.teachers);
    return list.map((c) => ({
      ...c,
      child_count: children.filter((x) => x.class_id === c.id).length,
      teacher_count: teachers.filter((x) => x.class_id === c.id).length,
    }));
  }

  if (action === 'teachers') {
    const where = classId ? { class_id: classId } : {};
    return listBy(COL.teachers, where);
  }

  if (action === 'children') {
    const where = classId ? { class_id: classId } : {};
    const classes = await listBy(COL.classes);
    const map = Object.fromEntries(classes.map((c) => [c.id, c.name]));
    const list = await listBy(COL.children, where);
    return list.map((ch) => ({ ...ch, class_name: map[ch.class_id] || '' }));
  }

  if (action === 'createChild') {
    const name = String(event.name || '').trim();
    if (!name || !event.classId) throw new Error('幼儿姓名和班级必填');
    const id = nid(10);
    const cls = await getClass(event.classId);
    await db.collection(COL.children).doc(id).set({
      data: {
        name,
        class_id: event.classId,
        gender: event.gender || '女',
        birthday: event.birthday || '',
        created_at: nowText(),
      },
    });
    return { id, name, class_id: event.classId, class_name: cls?.name || '', gender: event.gender || '女', birthday: event.birthday || '' };
  }

  if (action === 'matchGuide') {
    const cls = event.classId ? await getClass(event.classId) : null;
    let birthday = null;
    if (event.childIds && event.childIds[0]) {
      const child = await getChild(event.childIds[0]);
      birthday = child?.birthday;
    }
    const ageBand = inferAgeBand({ className: cls?.name, birthday, observedAt: event.observedAt });
    const ai = await aiMatch({ text: event.text, ageBand });
    return { ageBand, hits: ai.hits, interpret: ai.interpret, source: ai.source };
  }

  if (action === 'summarize') {
    return aiSummarize({
      childName: event.childName,
      className: event.className,
      observations: event.observations || [],
    });
  }

  if (action === 'observations') {
    const where = {};
    if (event.classId) where.class_id = event.classId;
    if (event.teacherId) where.teacher_id = event.teacherId;
    let query = db.collection(COL.observations);
    if (Object.keys(where).length) query = query.where(where);
    const res = await query.orderBy('observed_at', 'desc').limit(Number(event.limit) || 80).get();
    let rows = (res.data || []).map(withId);
    if (event.childId) {
      rows = rows.filter((o) => (o.children || []).some((c) => c.id === event.childId));
    }
    return rows;
  }

  if (action === 'createObservation') {
    const childIds = event.childIds || [];
    if (!event.teacherId || !event.classId || !event.observedAt) {
      throw new Error('缺少必要字段：teacherId / classId / observedAt');
    }
    if (!childIds.length) throw new Error('请至少指定一名幼儿');
    const teacher = await getTeacher(event.teacherId);
    const cls = await getClass(event.classId);
    const kids = [];
    for (const id of childIds) {
      const child = withId(await getChild(id));
      kids.push({
        id: child.id,
        name: child.name,
        class_id: child.class_id,
        class_name: cls?.name || '',
      });
    }
    const ageBand = inferAgeBand({
      className: cls?.name,
      birthday: (await getChild(childIds[0]))?.birthday,
      observedAt: event.observedAt,
    });
    const text = `${event.narrative || ''}\n${event.voiceTranscript || ''}`;
    let hits = event.guideHits && event.guideHits.length ? event.guideHits : null;
    let interpret = event.interpret || '';
    if (!hits || !interpret) {
      const ai = await aiMatch({ text, ageBand });
      hits = hits || ai.hits;
      interpret = interpret || ai.interpret || '';
    }
    const id = nid(12);
    const row = {
      teacher_id: event.teacherId,
      teacher_name: teacher?.name || '',
      class_id: event.classId,
      class_name: cls?.name || '',
      record_type: event.recordType || 'COA记录',
      observed_at: event.observedAt,
      narrative: event.narrative || '',
      voice_transcript: event.voiceTranscript || '',
      children: kids,
      media: [],
      guideHits: hits,
      interpret,
      stages: [],
      created_at: nowText(),
    };
    await db.collection(COL.observations).doc(id).set({ data: row });
    return withId({ _id: id, ...row });
  }

  if (action === 'addMedia') {
    const observationId = event.observationId;
    const fileID = event.fileID;
    if (!observationId || !fileID) throw new Error('请上传文件');
    const current = await db.collection(COL.observations).doc(observationId).get();
    const obs = current.data;
    if (!obs) throw new Error('记录不存在');
    const media = obs.media || [];
    media.push({
      id: nid(12),
      kind: event.kind || 'photo',
      filename: fileID,
      fileID,
      original_name: event.originalName || '',
      mime_type: event.mimeType || '',
      size: event.size || 0,
      sort_order: media.length,
    });
    await db.collection(COL.observations).doc(observationId).update({ data: { media } });
    return withId({ ...obs, media });
  }

  if (action === 'reportDocx') {
    const child = withId(await getChild(event.childId));
    if (!child) throw new Error('幼儿不存在');
    const cls = await getClass(child.class_id);
    child.class_name = cls?.name || '';
    const all = await db.collection(COL.observations).orderBy('observed_at', 'asc').limit(100).get();
    const observations = (all.data || [])
      .map(withId)
      .filter((o) => (o.children || []).some((c) => c.id === child.id));
    const dates = observations.map((o) => String(o.observed_at).slice(0, 10)).sort();
    const meta = {
      from: event.from || dates[0] || null,
      to: event.to || dates[dates.length - 1] || null,
      total: observations.length,
      coaCount: observations.filter((o) => o.record_type === 'COA记录').length,
    };
    const imageMap = {};
    for (const obs of observations) {
      for (const m of obs.media || []) {
        const fileID = m.fileID || m.filename;
        if (m.kind === 'photo' && fileID && fileID.indexOf('cloud://') === 0 && !imageMap[fileID]) {
          try {
            const down = await cloud.downloadFile({ fileID });
            imageMap[fileID] = down.fileContent;
          } catch {
            // skip missing photo
          }
        }
        if (m.kind === 'video' && fileID && fileID.indexOf('cloud://') === 0) {
          try {
            const tmp = await cloud.getTempFileURL({ fileList: [fileID] });
            m.tempUrl = tmp.fileList && tmp.fileList[0] ? tmp.fileList[0].tempFileURL : '';
          } catch {
            m.tempUrl = '';
          }
        }
      }
    }
    const buffer = await buildChildReport({
      child,
      observations,
      meta,
      kindergartenName: event.kindergartenName || '幼儿园',
      imageMap,
    });
    const cloudPath = `reports/${child.id}-${Date.now()}.docx`;
    const up = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer,
    });
    return { fileID: up.fileID, filename: `${child.name}-观察记录汇总.docx` };
  }

  throw new Error(`未知操作 ${action || ''}`);
}

exports.main = async (event) => {
  try {
    return await handle(event);
  } catch (err) {
    return { error: err.message || '服务失败' };
  }
};
