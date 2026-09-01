import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { db, uploadsDir } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedAssets = path.resolve(__dirname, '../../seed-assets');

const WHEAT_RECORDS = [
  {
    teacher: '王老师',
    at: '2026-03-30T10:20:00',
    children: ['小童', '小糖果'],
    stages: [
      ['社会领域', '冲突解决', 2],
      ['健康领域', '情绪管理', 2],
    ],
    photo: 'image1.png',
    narrative:
      '区域自主游戏，在教室建构区，小童用鸡蛋托和纸杯搭建了一个高楼，旁边的小糖果不小心把高楼碰倒了，小童说：“你把我的高楼碰倒了，我现在很生气”。之后又说：“小糖果，你现在来帮我把高楼一起修好”。',
  },
  {
    teacher: '杨飞',
    at: '2026-03-31T09:40:00',
    children: ['小童'],
    stages: [['科学领域', '空间方位', 2]],
    photo: 'image2.png',
    narrative:
      '区域时间，中二班活动室，小童拿着杯子指着鸡蛋托做的房子说我们把我们的宝藏藏在这个房子里。',
  },
  {
    teacher: '李美慧',
    at: '2026-04-27T10:05:00',
    children: ['小童', '熙熙'],
    stages: [['艺术领域', '角色扮演', 5]],
    photo: 'image3.png',
    narrative:
      '室内自主游戏时间教室里，小童拿着积塑玩具在搭房子，跟旁边的小朋友说你去拿材料吧，我赶紧把这个拼好，熙熙你赶紧和我一起拼。',
  },
  {
    teacher: '杨飞',
    at: '2026-04-27T16:10:00',
    children: ['小童', '周彦静'],
    stages: [['艺术领域', '角色扮演', 3]],
    photo: 'image4.png',
    narrative:
      '户外自主游戏时间，骑行区，小童和周彦静正在塑料木马上玩游戏，老师问：“你们这是在玩什么游戏呀。”小童回答道：“我们是在玩骑马的游戏，驾，快跑小马。”周彦静说：“我们正骑着小马一起去草坪玩呢，驾，小马快跑。”',
  },
  {
    teacher: '王老师',
    at: '2026-04-28T09:15:00',
    children: ['小童'],
    stages: [['科学领域', '模式', 5]],
    photo: 'image5.png',
    narrative: '教学活动时间，在活动室，小童使用套索方块拼建了一组ABCABC模式。',
  },
  {
    teacher: '李美慧',
    at: '2026-05-14T16:00:00',
    children: ['小童'],
    stages: [['语言领域', '对话与交流', 4]],
    photo: 'image6.png',
    narrative:
      '户外自主游戏时间跑道区，老师问小童，你在玩什么游戏？小童说我在玩打电话的游戏，老师问打给谁呢？小童说我在打给妈妈',
  },
  {
    teacher: '王老师',
    at: '2026-05-22T11:30:00',
    children: ['小童'],
    stages: [['健康领域', '生活自理和健康习惯', 5]],
    photo: 'image7.png',
    narrative:
      '午餐时间，中二班活动室，小童正大口的吃着饭，对老师说，老师，我大口吃饭就能长得高，身体也很棒。',
  },
  {
    teacher: '杨飞',
    at: '2026-05-24T16:20:00',
    children: ['小童'],
    stages: [['艺术领域', '律动', 1]],
    video: 'video1.mp4',
    poster: 'image8.png',
    narrative: '户外自主游戏时间，前坪，一边唱歌一边做动作。',
  },
  {
    teacher: '李美慧',
    at: '2026-06-17T10:10:00',
    children: ['小童'],
    stages: [['语言领域', '口语表达', 5]],
    photo: 'image9.png',
    narrative:
      '室内自主游戏环节，美工区，小童正在画画，她一边说，因为旁边画了一个黄色的植物，所以我要给我画的小人，也画黄色的衣服，这样就会更加搭配。',
  },
  {
    teacher: '杨飞',
    at: '2026-06-30T16:05:00',
    children: ['小童'],
    stages: [['艺术领域', '律动', 2]],
    video: 'video2.mp4',
    poster: 'image10.png',
    narrative:
      '户外自主游戏时间，操场，小童主动找到老师说：“老师我想听偶像万万岁。”老师播放音乐后小童跟着音乐有节奏的跳舞。',
  },
  {
    teacher: '王老师',
    at: '2026-06-30T09:50:00',
    children: ['小童'],
    stages: [['艺术领域', '美术', 5]],
    photo: 'image11.png',
    narrative:
      '集体教学活动时间，在中二班活动室，小童正在绘画会动的房子，她说我画的房子，我给它加了一个气球，所以他能动起来，而且我还给它装饰了一下，画上了大树小草小花，我觉得我画的非常漂亮。',
  },
];

const EXTRA_RECORDS = [
  {
    teacher: '李美慧',
    at: '2026-05-08T10:00:00',
    children: ['熙熙'],
    stages: [['社会领域', '冲突解决', 3]],
    photo: 'image3.png',
    narrative: '建构区，熙熙把积木分给旁边的小朋友，说我们一起把桥搭长一点。',
  },
  {
    teacher: '杨飞',
    at: '2026-06-03T15:40:00',
    children: ['周彦静', '朵朵'],
    stages: [['语言领域', '对话与交流', 3]],
    photo: 'image4.png',
    narrative: '沙水区，周彦静问朵朵要不要来帮忙挖河，朵朵说好，我们挖到那边去。',
  },
  {
    teacher: '王老师',
    at: '2026-06-12T11:20:00',
    children: ['晨晨'],
    stages: [['健康领域', '生活自理和健康习惯', 4]],
    photo: 'image7.png',
    narrative: '午餐后，晨晨自己把餐盘送到回收处，又去洗手，跟老师说我洗干净了。',
  },
];

function copyAsset(name) {
  const src = path.join(seedAssets, name);
  if (!fs.existsSync(src)) return null;
  const destName = `${path.parse(name).name}-${nanoid(6)}${path.extname(name)}`;
  const dest = path.join(uploadsDir, destName);
  fs.copyFileSync(src, dest);
  const stat = fs.statSync(dest);
  const ext = path.extname(name).toLowerCase();
  const kind = ext === '.mp4' ? 'video' : 'photo';
  const mime = ext === '.mp4' ? 'video/mp4' : 'image/png';
  return { filename: destName, kind, mime, size: stat.size };
}

function findStageId(domainName, indicatorName, level) {
  const row = db
    .prepare(
      `SELECT s.id FROM stages s
       JOIN indicators i ON i.id = s.indicator_id
       JOIN domains d ON d.id = i.domain_id
       WHERE d.name = ? AND i.name = ? AND s.level = ?`,
    )
    .get(domainName, indicatorName, level);
  return row?.id;
}

function teacherIdByName(name) {
  return db.prepare('SELECT id FROM teachers WHERE name = ?').get(name)?.id;
}

function childIdByName(name) {
  return db.prepare('SELECT id FROM children WHERE name = ?').get(name)?.id;
}

function insertRecord(rec, classId) {
  const teacherId = teacherIdByName(rec.teacher);
  const childIds = rec.children.map(childIdByName).filter(Boolean);
  if (!teacherId || !childIds.length) return;

  const id = nanoid(12);
  db.prepare(
    `INSERT INTO observations
      (id, teacher_id, class_id, record_type, observed_at, narrative)
     VALUES (?, ?, ?, 'COA记录', ?, ?)`,
  ).run(id, teacherId, classId, rec.at, rec.narrative);

  const insertChild = db.prepare(
    'INSERT INTO observation_children (observation_id, child_id) VALUES (?, ?)',
  );
  for (const cid of childIds) insertChild.run(id, cid);

  const insertStage = db.prepare(
    'INSERT INTO observation_stages (observation_id, stage_id) VALUES (?, ?)',
  );
  for (const [domain, indicator, level] of rec.stages) {
    const sid = findStageId(domain, indicator, level);
    if (sid) insertStage.run(id, sid);
  }

  const insertMedia = db.prepare(
    `INSERT INTO media
      (id, observation_id, kind, filename, original_name, mime_type, size, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let order = 0;
  if (rec.photo) {
    const file = copyAsset(rec.photo);
    if (file) insertMedia.run(nanoid(12), id, file.kind, file.filename, rec.photo, file.mime, file.size, order++);
  }
  if (rec.video) {
    const file = copyAsset(rec.video);
    if (file) insertMedia.run(nanoid(12), id, 'video', file.filename, rec.video, file.mime, file.size, order++);
  }
}

export function seedRecords() {
  const classRow = db.prepare("SELECT id FROM classes WHERE name = '中二班'").get();
  if (!classRow) return;
  const n = db.prepare('SELECT COUNT(*) AS c FROM observations').get().c;
  if (n >= 11) return;

  db.exec('DELETE FROM media');
  db.exec('DELETE FROM observation_stages');
  db.exec('DELETE FROM observation_children');
  db.exec('DELETE FROM observations');

  db.exec('BEGIN');
  try {
    for (const rec of [...WHEAT_RECORDS, ...EXTRA_RECORDS]) {
      insertRecord(rec, classRow.id);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
