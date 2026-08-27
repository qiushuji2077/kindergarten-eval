/**
 * 《3—6岁儿童学习与发展指南》规则捕捉。
 * 实录里出现关键词，即对应到领域 / 子领域 / 目标 / 年龄段典型表现。
 * 同时给出可写入报告的 COA 阶段（与现有发展状态字段对齐）。
 */

export const AGE_BANDS = ['3-4岁', '4-5岁', '5-6岁'];

export const GUIDE_RULES = [
  {
    id: 'health-emotion',
    domain: '健康',
    area: '身心状况',
    goal: '情绪安定愉快',
    keywords: ['生气', '高兴', '难过', '开心', '害怕', '情绪', '安慰'],
    typical: {
      '3-4岁': '情绪比较稳定。有比较强烈的情绪反应时，能在成人的安抚下逐渐平静下来。',
      '4-5岁': '经常保持愉快的情绪；不高兴时能较快缓解。愿意把自己的情绪告诉亲近的人，一起分享快乐或求得安慰。',
      '5-6岁': '表达情绪的方式比较多样，能随着活动的需要转换情绪和注意。',
    },
    coa: { domain: '健康领域', indicator: '情绪管理', level: 2 },
  },
  {
    id: 'health-habit',
    domain: '健康',
    area: '生活习惯与生活能力',
    goal: '具有良好的生活与卫生习惯',
    keywords: ['吃饭', '洗手', '刷牙', '睡觉', '喝水', '大口', '身体', '健康', '餐盘'],
    typical: {
      '3-4岁': '在成人提醒下，能洗手、喝水、如厕。不把脏手伸进嘴里。',
      '4-5岁': '能在成人帮助下，养成饭前便后洗手、每天刷牙等卫生习惯。知道保护眼睛、牙齿等。',
      '5-6岁': '能主动饮水、洗手、刷牙。能注意个人卫生，并知道其对健康的影响。',
    },
    coa: { domain: '健康领域', indicator: '生活自理和健康习惯', level: 5 },
  },
  {
    id: 'health-selfcare',
    domain: '健康',
    area: '生活习惯与生活能力',
    goal: '具有基本的生活自理能力',
    keywords: ['自己穿', '穿衣', '穿鞋', '整理', '自理', '收玩具'],
    typical: {
      '3-4岁': '在成人帮助下能穿脱衣服和鞋袜。能将玩具和图书放回原处。',
      '4-5岁': '能自己穿脱衣服、鞋袜、扣纽扣。能整理自己的物品。',
      '5-6岁': '能根据冷热增减衣服。会自己系鞋带。能按类别整理好自己的物品。',
    },
    coa: { domain: '健康领域', indicator: '生活自理和健康习惯', level: 4 },
  },
  {
    id: 'lang-talk',
    domain: '语言',
    area: '倾听与表达',
    goal: '愿意讲话并能清楚地表达',
    keywords: ['打电话', '告诉老师', '老师问', '对话', '交流', '回答道'],
    typical: {
      '3-4岁': '愿意在熟悉的人面前说话，能用短句表达自己的意思。',
      '4-5岁': '能基本完整地讲述自己的所见所闻和经历。说话时能使用常见的形容词、同义词等，语言比较生动。',
      '5-6岁': '能有序、连贯、清楚地讲述。能根据场合的需要，调整音量和语速。',
    },
    coa: { domain: '语言领域', indicator: '对话与交流', level: 4 },
  },
  {
    id: 'lang-complex',
    domain: '语言',
    area: '倾听与表达',
    goal: '愿意讲话并能清楚地表达',
    keywords: ['因为', '所以', '如果…就', '如果就'],
    typical: {
      '3-4岁': '能用简单句说出自己的需要和见闻。',
      '4-5岁': '能把事情的主要内容讲清楚，尝试使用一些连接词。',
      '5-6岁': '讲述时能使用表示因果、假设、转折等关系的连接词，把事情说清楚、说完整。',
    },
    coa: { domain: '语言领域', indicator: '口语表达', level: 5 },
  },
  {
    id: 'social-conflict',
    domain: '社会',
    area: '人际交往',
    goal: '能与同伴友好相处',
    keywords: ['碰倒', '生气', '一起修', '冲突', '抢', '分享', '轮流', '对不起', '商量'],
    typical: {
      '3-4岁': '想加入同伴的游戏时，能友好地提出请求。在成人的指导下，不争抢、不独霸玩具。',
      '4-5岁': '会运用介绍自己、交换玩具等办法吸引同伴。与同伴发生冲突时，能在他人帮助下和平解决。',
      '5-6岁': '能想办法吸引同伴和自己一起游戏。活动时能与同伴分工合作，遇到困难能一起克服。',
    },
    coa: { domain: '社会领域', indicator: '冲突解决', level: 2 },
  },
  {
    id: 'social-together',
    domain: '社会',
    area: '人际交往',
    goal: '愿意与人交往',
    keywords: ['一起帮忙', '好朋友', '分享', '新朋友'],
    minHits: 1,
    typical: {
      '3-4岁': '对家长和老师有礼貌。愿意和熟悉的同伴一起游戏。',
      '4-5岁': '有自己的好朋友，也有新朋友。能与朋友分享快乐和烦恼。',
      '5-6岁': '能想出办法来吸引同伴和自己一起游戏。对大家都喜欢的东西能轮流、分享。',
    },
    coa: { domain: '社会领域', indicator: '冲突解决', level: 3 },
  },
  {
    id: 'science-space',
    domain: '科学',
    area: '数学认知',
    goal: '感知形状与空间关系',
    keywords: ['里面', '外面', '上面', '下面', '旁边', '藏在', '房子里'],
    typical: {
      '3-4岁': '能感知物体基本的空间位置，如上下、前后、里外等。',
      '4-5岁': '能使用上下、前后、里外、中间、旁边等方位词描述物体的位置和运动方向。',
      '5-6岁': '能理解并描述周围物体的空间关系。能按语言指示拿取或放置物品。',
    },
    coa: { domain: '科学领域', indicator: '空间方位', level: 2 },
  },
  {
    id: 'science-pattern',
    domain: '科学',
    area: '数学认知',
    goal: '感知和理解数、量及数量关系',
    keywords: ['模式', 'ABC', '重复', '规律', '排序', '一套'],
    typical: {
      '3-4岁': '能感知和区分物体的大小、多少、高矮、长短等量的特征。',
      '4-5岁': '能通过数数比较两组物体的多少。能找出生活中简单的排列规律。',
      '5-6岁': '能发现生活中许多问题都可以用数学的方法来解决。能创造并描述较复杂的排列规律。',
    },
    coa: { domain: '科学领域', indicator: '模式', level: 5 },
  },
  {
    id: 'art-role',
    domain: '艺术',
    area: '表现与创造',
    goal: '具有初步的艺术表现与创造能力',
    keywords: ['扮演', '假装', '骑马', '我们是在玩', '角色'],
    typical: {
      '3-4岁': '经常自哼自唱或模仿有趣的动作、表情和声调。能用声音、动作、姿态模拟自然界的事物和生活情景。',
      '4-5岁': '经常唱唱跳跳，愿意参加歌唱、律动、舞蹈、表演等活动。能用自己编的情节做游戏。',
      '5-6岁': '能用多种工具、材料或不同的表现手法表达自己的感受和想象。能与他人合作进行艺术活动。',
    },
    coa: { domain: '艺术领域', indicator: '角色扮演', level: 3 },
  },
  {
    id: 'art-coop-role',
    domain: '艺术',
    area: '表现与创造',
    goal: '具有初步的艺术表现与创造能力',
    keywords: ['一起拼', '你去拿材料', '一起挖', '分工'],
    typical: {
      '3-4岁': '能用声音、动作、姿态模拟自然界的事物和生活情景。',
      '4-5岁': '能用自己编的情节做游戏，并能用动作和语言表现出来。',
      '5-6岁': '能与他人合作进行艺术活动，进行表演、创作等。会用自己的作品美化环境。',
    },
    coa: { domain: '艺术领域', indicator: '角色扮演', level: 5 },
  },
  {
    id: 'art-rhythm',
    domain: '艺术',
    area: '感受与欣赏',
    goal: '喜欢自然界与生活中美的事物',
    keywords: ['唱歌', '跳舞', '跟着音乐', '律动', '有节奏'],
    typical: {
      '3-4岁': '喜欢听音乐或观看舞蹈、戏剧等表演。能用声音、动作等表现自己的感受。',
      '4-5岁': '喜欢用自己的方式表达对音乐、舞蹈的感受。能随着音乐的节奏做简单的身体动作。',
      '5-6岁': '能用表情、动作、语言等方式表达自己对音乐、舞蹈作品的理解。',
    },
    coa: { domain: '艺术领域', indicator: '律动', level: 2 },
  },
  {
    id: 'art-visual',
    domain: '艺术',
    area: '表现与创造',
    goal: '具有初步的艺术表现与创造能力',
    keywords: ['画画', '绘画', '颜色', '装饰', '作品', '气球', '漂亮'],
    typical: {
      '3-4岁': '能用简单的线条和色彩大体画出自己想画的人或事物。',
      '4-5岁': '能用绘图、手工等方式表现自己观察或想象到的事物，能表现事物的基本部分和主要特征。',
      '5-6岁': '能用多种工具、材料或不同的表现手法表达自己的感受和想象。能与他人分享自己作品的想法。',
    },
    coa: { domain: '艺术领域', indicator: '美术', level: 5 },
  },
];

export function inferAgeBand({ className, birthday, observedAt } = {}) {
  if (className) {
    if (className.includes('小')) return '3-4岁';
    if (className.includes('中')) return '4-5岁';
    if (className.includes('大')) return '5-6岁';
  }
  if (birthday && observedAt) {
    const years =
      (new Date(observedAt.slice(0, 10)).getTime() - new Date(birthday).getTime()) /
      (365.25 * 24 * 3600 * 1000);
    if (years < 4) return '3-4岁';
    if (years < 5) return '4-5岁';
    return '5-6岁';
  }
  return '4-5岁';
}

export function matchGuide(text, ageBand = '4-5岁') {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const band = AGE_BANDS.includes(ageBand) ? ageBand : '4-5岁';
  const hits = [];
  for (const rule of GUIDE_RULES) {
    const matched = [...new Set(rule.keywords.filter((k) => k && raw.includes(k)))];
    const need = rule.minHits || 1;
    if (matched.length < need) continue;
    hits.push({
      id: rule.id,
      domain: rule.domain,
      area: rule.area,
      goal: rule.goal,
      ageBand: band,
      typical: rule.typical[band],
      keywords: matched,
      coa: rule.coa,
    });
  }
  return hits;
}

export function getGuideCatalog() {
  return GUIDE_RULES.map((rule) => ({
    id: rule.id,
    domain: rule.domain,
    area: rule.area,
    goal: rule.goal,
    keywords: rule.keywords,
    typical: rule.typical,
  }));
}
