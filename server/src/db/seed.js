import { nanoid } from 'nanoid';
import { db } from './index.js';
import { seedRecords } from './seed-records.js';
import { backfillGuideHits } from '../services/store.js';

const COA = [
  {
    domain: '健康领域',
    indicators: [
      {
        name: '情绪管理',
        stages: [
          [1, '儿童能通过表情或动作表达基本情绪。', '用表情动作表达情绪'],
          [2, '儿童会命名一种情绪，表现为能用简单的情绪词汇（如高兴、生气、难过等）表达基本的情绪（自己的或他人的）。', '使用简单的情绪词汇表达基本情绪'],
          [3, '儿童能在成人引导下用适宜方式调节情绪。', '在引导下调节情绪'],
          [4, '儿童能主动选择适宜方式调节自己的情绪。', '主动调节情绪'],
          [5, '儿童能理解他人情绪并给予简单回应。', '理解并回应他人情绪'],
        ],
      },
      {
        name: '生活自理和健康习惯',
        stages: [
          [1, '儿童在成人帮助下完成基本生活自理。', '需帮助完成自理'],
          [2, '儿童能独立完成部分生活自理动作。', '独立完成部分自理'],
          [3, '儿童能按要求完成洗手、进餐等常规。', '按要求完成常规'],
          [4, '儿童能主动完成常见生活自理并注意卫生。', '主动完成自理与卫生'],
          [5, '儿童会主动做出一个对身体健康有益的选择，并能解释对自己的好处。', '主动做出有益健康的行为，并解释好处'],
        ],
      },
    ],
  },
  {
    domain: '语言领域',
    indicators: [
      {
        name: '对话与交流',
        stages: [
          [1, '儿童能用单词或短句回应成人。', '单词短句回应'],
          [2, '儿童能主动发起简单交流。', '主动发起交流'],
          [3, '儿童能围绕一个话题进行来回交流。', '话题来回交流'],
          [4, '能进行简短对话，以回应为主。', '简短对话'],
          [5, '儿童能主动延续话题并补充信息。', '延续话题并补充'],
        ],
      },
      {
        name: '口语表达',
        stages: [
          [1, '儿童能用短语描述眼前事物。', '短语描述'],
          [2, '儿童能说完整短句。', '完整短句'],
          [3, '儿童能按顺序讲述简单事情。', '顺序讲述'],
          [4, '儿童能较清楚地讲述经历或想法。', '清楚讲述'],
          [5, '儿童会用复句陈述发生过的事或满足一定条件就会发生的事情（句中含有“因为...所以”“如果...就”等关联词）。', '表达中有逻辑性关联词'],
        ],
      },
    ],
  },
  {
    domain: '社会领域',
    indicators: [
      {
        name: '冲突解决',
        stages: [
          [1, '儿童在冲突中主要依赖成人介入。', '依赖成人介入'],
          [2, '儿童有了解决冲突的意识，试图用简单的方法解决冲突（如说“是我的”或抢回玩具）。', '用简单的动作、语言维护自己的权益'],
          [3, '儿童能提出简单解决办法并尝试协商。', '提出办法并协商'],
          [4, '儿童能在冲突中考虑他人感受。', '考虑他人感受'],
          [5, '儿童能较冷静地协商并达成双方可接受的结果。', '冷静协商并达成结果'],
        ],
      },
    ],
  },
  {
    domain: '科学领域',
    indicators: [
      {
        name: '空间方位',
        stages: [
          [1, '儿童能感知物体远近。', '感知远近'],
          [2, '儿童能理解基本方位概念："上"、"下"、"里"、"外"、"旁边"。', '理解基本方位概念'],
          [3, '儿童能按方位指令摆放物品。', '按方位指令摆放'],
          [4, '儿童能用方位词描述物体位置。', '用方位词描述'],
          [5, '儿童能比较并说明相对位置关系。', '比较相对位置'],
        ],
      },
      {
        name: '模式',
        stages: [
          [1, '儿童能感知简单重复。', '感知重复'],
          [2, '儿童能识别 ABAB 模式。', '识别ABAB'],
          [3, '儿童能延续简单模式。', '延续简单模式'],
          [4, '儿童能创建简单模式。', '创建简单模式'],
          [5, '儿童能创建一个较为复杂的模式（如ABCABCABC），该模式至少有三次重复。', '独立创建较为复杂的模式'],
        ],
      },
    ],
  },
  {
    domain: '艺术领域',
    indicators: [
      {
        name: '角色扮演',
        stages: [
          [1, '儿童能模仿简单动作。', '模仿动作'],
          [2, '儿童能给物品赋予角色。', '物品赋予角色'],
          [3, '儿童能通过语言或动作扮演某个角色的简单特征，或给物品赋予某个角色。', '有角色意识，能简单扮演'],
          [4, '儿童能与同伴进行简单角色互动。', '同伴角色互动'],
          [5, '儿童与至少两个儿童一起玩有不断发展故事线的角色游戏，并能跳出角色给他人指示。', '多角色，多情节的合作游戏，并能跳出个人角色指导其他角色'],
        ],
      },
      {
        name: '律动',
        stages: [
          [1, '儿童听到音乐时，会跟着音乐做出身体动作的反应，如站立蹲下、蹦跳、转动头部、摇晃身体。', '听到音乐做出动作'],
          [2, '儿童会主动地跟随音乐做动作，这些动作是有一定规律的。', '跟随音乐做动作，动作有规律'],
          [3, '儿童能跟上节奏变化。', '跟上节奏变化'],
          [4, '儿童能创编简单动作。', '创编动作'],
          [5, '儿童能与同伴配合完成律动。', '同伴配合律动'],
        ],
      },
      {
        name: '美术',
        stages: [
          [1, '儿童能进行涂鸦与简单造型。', '涂鸦造型'],
          [2, '儿童能表现可辨认的形象。', '可辨认形象'],
          [3, '儿童能有意识地选择颜色与材料。', '选择颜色材料'],
          [4, '儿童能讲述自己作品的内容。', '讲述作品'],
          [5, '儿童能有意识地创作出多个细节的复杂作品，并能讲述作品的细节与想法。', '创作多细节复杂作品，并能表达'],
        ],
      },
    ],
  },
];

function seedFramework() {
  const domainCount = db.prepare('SELECT COUNT(*) AS c FROM domains').get().c;
  if (domainCount > 0) return;

  const insertDomain = db.prepare('INSERT INTO domains (id, name, sort_order) VALUES (?, ?, ?)');
  const insertIndicator = db.prepare(
    'INSERT INTO indicators (id, domain_id, name, sort_order) VALUES (?, ?, ?, ?)',
  );
  const insertStage = db.prepare(
    'INSERT INTO stages (id, indicator_id, level, description, key_point) VALUES (?, ?, ?, ?, ?)',
  );

  db.exec('BEGIN');
  try {
    COA.forEach((d, di) => {
      const domainId = nanoid(10);
      insertDomain.run(domainId, d.domain, di + 1);
      d.indicators.forEach((ind, ii) => {
        const indicatorId = nanoid(10);
        insertIndicator.run(indicatorId, domainId, ind.name, ii + 1);
        ind.stages.forEach(([level, description, keyPoint]) => {
          insertStage.run(nanoid(10), indicatorId, level, description, keyPoint);
        });
      });
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function seedDemo() {
  const childCount = db.prepare('SELECT COUNT(*) AS c FROM children').get().c;
  if (childCount > 0) return;

  const classId = nanoid(10);
  const teacherIds = [nanoid(10), nanoid(10), nanoid(10)];
  const childIds = [nanoid(10), nanoid(10), nanoid(10), nanoid(10)];

  db.prepare('INSERT INTO classes (id, name) VALUES (?, ?)').run(classId, '中二班');
  const insertTeacher = db.prepare(
    'INSERT INTO teachers (id, name, phone, class_id) VALUES (?, ?, ?, ?)',
  );
  insertTeacher.run(teacherIds[0], '杨飞', '13800000001', classId);
  insertTeacher.run(teacherIds[1], '李美慧', '13800000002', classId);
  insertTeacher.run(teacherIds[2], '王老师', '13800000003', classId);

  const insertChild = db.prepare(
    'INSERT INTO children (id, name, class_id, gender, birthday) VALUES (?, ?, ?, ?, ?)',
  );
  insertChild.run(childIds[0], '小麦', classId, '女', '2021-05-12');
  insertChild.run(childIds[1], '小糖果', classId, '女', '2021-08-03');
  insertChild.run(childIds[2], '熙熙', classId, '男', '2021-03-21');
  insertChild.run(childIds[3], '周彦静', classId, '女', '2021-11-09');
}

function ensureChildren() {
  const classRow = db.prepare("SELECT id FROM classes WHERE name = '中二班'").get();
  if (!classRow) {
    seedDemo();
    return;
  }
  const extras = [
    ['朵朵', '女', '2021-09-02'],
    ['晨晨', '男', '2021-06-18'],
    ['安安', '女', '2021-04-11'],
    ['乐乐', '男', '2021-07-26'],
    ['悠悠', '女', '2021-10-08'],
    ['果果', '女', '2021-12-01'],
    ['轩轩', '男', '2021-02-19'],
    ['诺诺', '女', '2021-08-22'],
  ];
  const insert = db.prepare(
    'INSERT INTO children (id, name, class_id, gender, birthday) VALUES (?, ?, ?, ?, ?)',
  );
  for (const [name, gender, birthday] of extras) {
    const exists = db.prepare('SELECT id FROM children WHERE name = ? AND class_id = ?').get(
      name,
      classRow.id,
    );
    if (!exists) insert.run(nanoid(10), name, classRow.id, gender, birthday);
  }
}

function patchRhythmStage1() {
  db.prepare(
    `UPDATE stages SET description = ?, key_point = ?
     WHERE id IN (
       SELECT s.id FROM stages s
       JOIN indicators i ON i.id = s.indicator_id
       WHERE i.name = '律动' AND s.level = 1
     )`,
  ).run(
    '儿童听到音乐时，会跟着音乐做出身体动作的反应，如站立蹲下、蹦跳、转动头部、摇晃身体。',
    '听到音乐做出动作',
  );
}

seedFramework();
seedDemo();
ensureChildren();
patchRhythmStage1();
seedRecords();
backfillGuideHits();
console.log('Seed completed.');
