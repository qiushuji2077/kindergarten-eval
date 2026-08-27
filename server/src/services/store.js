import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { inferAgeBand, matchGuide } from './guide.js';

function findCoaStageId(coa) {
  if (!coa) return null;
  const row = db
    .prepare(
      `SELECT s.id FROM stages s
       JOIN indicators i ON i.id = s.indicator_id
       JOIN domains d ON d.id = i.domain_id
       WHERE d.name = ? AND i.name = ? AND s.level = ?`,
    )
    .get(coa.domain, coa.indicator, coa.level);
  return row?.id || null;
}

function saveGuideHits(observationId, hits) {
  const insert = db.prepare(
    `INSERT INTO observation_guide
      (id, observation_id, rule_id, domain, area, goal, age_band, typical, keywords)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const hit of hits) {
    insert.run(
      nanoid(12),
      observationId,
      hit.id,
      hit.domain,
      hit.area,
      hit.goal,
      hit.ageBand,
      hit.typical,
      JSON.stringify(hit.keywords),
    );
  }
}

function loadGuideHits(observationId) {
  return db
    .prepare(
      `SELECT rule_id AS id, domain, area, goal, age_band AS ageBand, typical, keywords
       FROM observation_guide WHERE observation_id = ? ORDER BY rowid`,
    )
    .all(observationId)
    .map((h) => ({
      ...h,
      keywords: (() => {
        try {
          return JSON.parse(h.keywords);
        } catch {
          return [];
        }
      })(),
    }));
}

export function resolveAgeBand({ classId, childIds, observedAt }) {
  const cls = classId
    ? db.prepare('SELECT name FROM classes WHERE id = ?').get(classId)
    : null;
  let birthday = null;
  if (childIds?.[0]) {
    birthday = db.prepare('SELECT birthday FROM children WHERE id = ?').get(childIds[0])?.birthday;
  }
  return inferAgeBand({ className: cls?.name, birthday, observedAt });
}

export function previewGuideMatch({ text, classId, childIds, observedAt }) {
  const ageBand = resolveAgeBand({ classId, childIds, observedAt });
  return {
    ageBand,
    hits: matchGuide(text, ageBand),
  };
}

function mapObservation(row) {
  if (!row) return null;
  const children = db
    .prepare(
      `SELECT c.id, c.name, c.class_id, cl.name AS class_name
       FROM observation_children oc
       JOIN children c ON c.id = oc.child_id
       JOIN classes cl ON cl.id = c.class_id
       WHERE oc.observation_id = ?`,
    )
    .all(row.id);

  const stages = db
    .prepare(
      `SELECT s.id, s.level, s.description, s.key_point,
              i.name AS indicator_name, d.name AS domain_name
       FROM observation_stages os
       JOIN stages s ON s.id = os.stage_id
       JOIN indicators i ON i.id = s.indicator_id
       JOIN domains d ON d.id = i.domain_id
       WHERE os.observation_id = ?
       ORDER BY os.rowid`,
    )
    .all(row.id);

  const media = db
    .prepare(
      `SELECT id, kind, filename, original_name, mime_type, size, duration_ms, sort_order
       FROM media WHERE observation_id = ? ORDER BY sort_order, created_at`,
    )
    .all(row.id)
    .map((m) => ({
      ...m,
      url: `/uploads/${m.filename}`,
    }));

  return {
    ...row,
    children,
    stages,
    media,
    guideHits: loadGuideHits(row.id),
  };
}

export function listObservations({ classId, childId, teacherId, limit = 50 } = {}) {
  let sql = `
    SELECT o.*, t.name AS teacher_name, cl.name AS class_name
    FROM observations o
    JOIN teachers t ON t.id = o.teacher_id
    JOIN classes cl ON cl.id = o.class_id
    WHERE 1=1
  `;
  const params = [];
  if (classId) {
    sql += ' AND o.class_id = ?';
    params.push(classId);
  }
  if (teacherId) {
    sql += ' AND o.teacher_id = ?';
    params.push(teacherId);
  }
  if (childId) {
    sql +=
      ' AND EXISTS (SELECT 1 FROM observation_children oc WHERE oc.observation_id = o.id AND oc.child_id = ?)';
    params.push(childId);
  }
  sql += ' ORDER BY o.observed_at DESC, o.created_at DESC LIMIT ?';
  params.push(Number(limit) || 80);

  return db.prepare(sql).all(...params).map(mapObservation);
}

export function getObservation(id) {
  const row = db
    .prepare(
      `SELECT o.*, t.name AS teacher_name, cl.name AS class_name
       FROM observations o
       JOIN teachers t ON t.id = o.teacher_id
       JOIN classes cl ON cl.id = o.class_id
       WHERE o.id = ?`,
    )
    .get(id);
  return mapObservation(row);
}

export function createObservation(payload, files = []) {
  const id = nanoid(12);
  const {
    teacherId,
    classId,
    recordType = 'COA记录',
    observedAt,
    narrative = '',
    voiceTranscript = '',
    childIds = [],
    stageIds = [],
  } = payload;

  if (!teacherId || !classId || !observedAt) {
    throw new Error('缺少必要字段：teacherId / classId / observedAt');
  }
  if (!Array.isArray(childIds) || childIds.length === 0) {
    throw new Error('请至少指定一名幼儿');
  }

  const insertObs = db.prepare(`
    INSERT INTO observations
      (id, teacher_id, class_id, record_type, observed_at, narrative, voice_transcript)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChild = db.prepare(
    'INSERT INTO observation_children (observation_id, child_id) VALUES (?, ?)',
  );
  const insertStage = db.prepare(
    'INSERT INTO observation_stages (observation_id, stage_id) VALUES (?, ?)',
  );
  const insertMedia = db.prepare(`
    INSERT INTO media
      (id, observation_id, kind, filename, original_name, mime_type, size, duration_ms, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    insertObs.run(
      id,
      teacherId,
      classId,
      recordType,
      observedAt,
      narrative,
      voiceTranscript || null,
    );
    for (const childId of childIds) insertChild.run(id, childId);

    const ageBand = resolveAgeBand({ classId, childIds, observedAt });
    const hits = matchGuide(`${narrative}\n${voiceTranscript || ''}`, ageBand);
    saveGuideHits(id, hits);

    const autoStageIds = hits.map((h) => findCoaStageId(h.coa)).filter(Boolean);
    const finalStageIds = [...new Set([...(stageIds || []), ...autoStageIds])];
    for (const stageId of finalStageIds) insertStage.run(id, stageId);
    files.forEach((f, idx) => {
      insertMedia.run(
        nanoid(12),
        id,
        f.kind,
        f.filename,
        f.originalName || null,
        f.mimeType || null,
        f.size || null,
        f.durationMs || null,
        idx,
      );
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return getObservation(id);
}

export function addObservationMedia(observationId, file) {
  const obs = getObservation(observationId);
  if (!obs) throw new Error('记录不存在');
  const sort = (obs.media || []).length;
  db.prepare(
    `INSERT INTO media
      (id, observation_id, kind, filename, original_name, mime_type, size, duration_ms, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(12),
    observationId,
    file.kind,
    file.filename,
    file.originalName || null,
    file.mimeType || null,
    file.size || null,
    file.durationMs || null,
    sort,
  );
  return getObservation(observationId);
}

export function deleteObservation(id) {
  const info = db.prepare('DELETE FROM observations WHERE id = ?').run(id);
  return info.changes > 0;
}

export function listClasses() {
  return db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM children ch WHERE ch.class_id = c.id) AS child_count,
        (SELECT COUNT(*) FROM teachers t WHERE t.class_id = c.id) AS teacher_count
       FROM classes c ORDER BY c.created_at`,
    )
    .all();
}

export function listTeachers(classId) {
  let sql = 'SELECT * FROM teachers';
  const params = [];
  if (classId) {
    sql += ' WHERE class_id = ?';
    params.push(classId);
  }
  sql += ' ORDER BY created_at';
  return db.prepare(sql).all(...params);
}

export function listChildren(classId) {
  let sql = `
    SELECT ch.*, cl.name AS class_name
    FROM children ch JOIN classes cl ON cl.id = ch.class_id
  `;
  const params = [];
  if (classId) {
    sql += ' WHERE ch.class_id = ?';
    params.push(classId);
  }
  sql += ' ORDER BY ch.name';
  return db.prepare(sql).all(...params);
}

export function createChild({ name, classId, gender, birthday }) {
  const id = nanoid(10);
  db.prepare(
    'INSERT INTO children (id, name, class_id, gender, birthday) VALUES (?, ?, ?, ?, ?)',
  ).run(id, name, classId, gender || null, birthday || null);
  return db
    .prepare(
      `SELECT ch.*, cl.name AS class_name FROM children ch
       JOIN classes cl ON cl.id = ch.class_id WHERE ch.id = ?`,
    )
    .get(id);
}

export function createClass(name) {
  const id = nanoid(10);
  db.prepare('INSERT INTO classes (id, name) VALUES (?, ?)').run(id, name);
  return db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
}

export function createTeacher({ name, phone, classId }) {
  const id = nanoid(10);
  db.prepare('INSERT INTO teachers (id, name, phone, class_id) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    phone || null,
    classId || null,
  );
  return db.prepare('SELECT * FROM teachers WHERE id = ?').get(id);
}

export function getFramework() {
  const domains = db.prepare('SELECT * FROM domains ORDER BY sort_order').all();
  return domains.map((d) => {
    const indicators = db
      .prepare('SELECT * FROM indicators WHERE domain_id = ? ORDER BY sort_order')
      .all(d.id)
      .map((ind) => ({
        ...ind,
        stages: db
          .prepare('SELECT * FROM stages WHERE indicator_id = ? ORDER BY level')
          .all(ind.id),
      }));
    return { ...d, indicators };
  });
}

export function getChildReportData(childId, { from, to } = {}) {
  const child = db
    .prepare(
      `SELECT ch.*, cl.name AS class_name FROM children ch
       JOIN classes cl ON cl.id = ch.class_id WHERE ch.id = ?`,
    )
    .get(childId);
  if (!child) throw new Error('幼儿不存在');

  let sql = `
    SELECT o.*, t.name AS teacher_name, cl.name AS class_name
    FROM observations o
    JOIN teachers t ON t.id = o.teacher_id
    JOIN classes cl ON cl.id = o.class_id
    JOIN observation_children oc ON oc.observation_id = o.id
    WHERE oc.child_id = ?
  `;
  const params = [childId];
  if (from) {
    sql += ' AND date(o.observed_at) >= date(?)';
    params.push(from);
  }
  if (to) {
    sql += ' AND date(o.observed_at) <= date(?)';
    params.push(to);
  }
  sql += ' ORDER BY o.observed_at ASC, o.created_at ASC';

  const observations = db.prepare(sql).all(...params).map(mapObservation);
  const dates = observations.map((o) => o.observed_at.slice(0, 10)).sort();
  return {
    child,
    observations,
    meta: {
      from: from || dates[0] || null,
      to: to || dates[dates.length - 1] || null,
      total: observations.length,
      coaCount: observations.filter((o) => o.record_type === 'COA记录').length,
    },
  };
}

export function backfillGuideHits() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS observation_guide (
      id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
      rule_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      area TEXT NOT NULL,
      goal TEXT NOT NULL,
      age_band TEXT NOT NULL,
      typical TEXT NOT NULL,
      keywords TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  const n = db.prepare('SELECT COUNT(*) AS c FROM observation_guide').get().c;
  if (n > 0) return;
  const rows = db
    .prepare(
      `SELECT o.id, o.narrative, o.voice_transcript, o.observed_at, o.class_id
       FROM observations o`,
    )
    .all();
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const childIds = db
        .prepare('SELECT child_id FROM observation_children WHERE observation_id = ?')
        .all(row.id)
        .map((r) => r.child_id);
      const ageBand = resolveAgeBand({
        classId: row.class_id,
        childIds,
        observedAt: row.observed_at,
      });
      const hits = matchGuide(`${row.narrative || ''}\n${row.voice_transcript || ''}`, ageBand);
      saveGuideHits(row.id, hits);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

