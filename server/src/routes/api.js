import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import { uploadsDir } from '../db/index.js';
import * as store from '../services/store.js';
import { generateChildReportDocx } from '../services/report.js';
import { getGuideCatalog } from '../services/guide.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || guessExt(file.mimetype);
    cb(null, `${Date.now()}-${nanoid(8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024, files: 9 },
});

function guessExt(mime = '') {
  if (mime.includes('jpeg')) return '.jpg';
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('mp4')) return '.mp4';
  if (mime.includes('quicktime')) return '.mov';
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
  if (mime.includes('wav')) return '.wav';
  if (mime.includes('ogg')) return '.ogg';
  return '';
}

function detectKind(file) {
  const mime = file.mimetype || '';
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const name = (file.originalname || '').toLowerCase();
  if (/\.(jpg|jpeg|png|webp|heic)$/.test(name)) return 'photo';
  if (/\.(mp4|mov|webm|m4v)$/.test(name)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac)$/.test(name)) return 'audio';
  return 'photo';
}

function parseList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'kindergarten-eval' });
});

router.get('/classes', (_req, res) => {
  res.json(store.listClasses());
});

router.post('/classes', (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: '班级名称不能为空' });
  res.status(201).json(store.createClass(name.trim()));
});

router.get('/teachers', (req, res) => {
  res.json(store.listTeachers(req.query.classId));
});

router.post('/teachers', (req, res) => {
  const { name, phone, classId } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: '教师姓名不能为空' });
  res.status(201).json(store.createTeacher({ name: name.trim(), phone, classId }));
});

router.get('/children', (req, res) => {
  res.json(store.listChildren(req.query.classId));
});

router.post('/children', (req, res) => {
  const { name, classId, gender, birthday } = req.body || {};
  if (!name?.trim() || !classId) {
    return res.status(400).json({ error: '幼儿姓名和班级必填' });
  }
  res.status(201).json(store.createChild({ name: name.trim(), classId, gender, birthday }));
});

router.get('/framework', (_req, res) => {
  res.json(store.getFramework());
});

router.get('/guide', (_req, res) => {
  res.json(getGuideCatalog());
});

router.post('/guide/match', (req, res) => {
  const body = req.body || {};
  const text = body.text || body.narrative || '';
  res.json(
    store.previewGuideMatch({
      text,
      classId: body.classId,
      childIds: parseList(body.childIds),
      observedAt: body.observedAt,
    }),
  );
});

router.get('/observations', (req, res) => {
  res.json(
    store.listObservations({
      classId: req.query.classId,
      childId: req.query.childId,
      teacherId: req.query.teacherId,
      limit: req.query.limit,
    }),
  );
});

router.get('/observations/:id', (req, res) => {
  const obs = store.getObservation(req.params.id);
  if (!obs) return res.status(404).json({ error: '记录不存在' });
  res.json(obs);
});

router.post('/observations/text', (req, res) => {
  try {
    const body = req.body || {};
    const created = store.createObservation({
      teacherId: body.teacherId,
      classId: body.classId,
      recordType: body.recordType || 'COA记录',
      observedAt: body.observedAt,
      narrative: body.narrative || '',
      voiceTranscript: body.voiceTranscript || '',
      childIds: parseList(body.childIds),
      stageIds: parseList(body.stageIds),
    }, []);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message || '创建失败' });
  }
});

router.post('/observations', upload.array('media', 9), (req, res) => {
  try {
    const body = req.body || {};
    const files = (req.files || []).map((f) => ({
      kind: detectKind(f),
      filename: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size,
      durationMs: body.durationMs ? Number(body.durationMs) : null,
    }));

    const created = store.createObservation(
      {
        teacherId: body.teacherId,
        classId: body.classId,
        recordType: body.recordType || 'COA记录',
        observedAt: body.observedAt,
        narrative: body.narrative || '',
        voiceTranscript: body.voiceTranscript || '',
        childIds: parseList(body.childIds),
        stageIds: parseList(body.stageIds),
      },
      files,
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message || '创建失败' });
  }
});

router.post('/observations/:id/media', upload.single('media'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    const f = req.file;
    const updated = store.addObservationMedia(req.params.id, {
      kind: detectKind(f),
      filename: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size,
    });
    res.status(201).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || '上传失败' });
  }
});

router.delete('/observations/:id', (req, res) => {
  const ok = store.deleteObservation(req.params.id);
  if (!ok) return res.status(404).json({ error: '记录不存在' });
  res.json({ ok: true });
});

router.get('/reports/child/:childId/docx', async (req, res) => {
  try {
    const publicBaseUrl = `${req.protocol}://${req.get('host')}`;
    const { buffer, filename } = await generateChildReportDocx(req.params.childId, {
      from: req.query.from,
      to: req.query.to,
      kindergartenName: req.query.kindergartenName || '幼儿园',
      publicBaseUrl,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('report error', err);
    res.status(400).json({ error: err.message || '报告生成失败' });
  }
});

// backward-compatible alias
router.get('/reports/child/:childId.docx', (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, `/api/reports/child/${req.params.childId}/docx${q}`);
});

router.get('/reports/child/:childId/preview', (req, res) => {
  try {
    const data = store.getChildReportData(req.params.childId, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message || '预览失败' });
  }
});

export default router;
