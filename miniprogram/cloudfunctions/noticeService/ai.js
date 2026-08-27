const cloud = require('wx-server-sdk');
const { GUIDE_RULES, matchGuide } = require('./guide');

const MODELS = ['hunyuan-turbos-latest', 'hy3-preview', 'hunyuan-lite'];

function catalog() {
  return GUIDE_RULES.map((r) => ({
    id: r.id,
    domain: r.domain,
    area: r.area,
    goal: r.goal,
  }));
}

function extractContent(res) {
  if (!res) return '';
  if (typeof res === 'string') return res;
  const choice = res.choices && res.choices[0];
  if (choice && choice.message && choice.message.content) return choice.message.content;
  if (choice && choice.delta && choice.delta.content) return choice.delta.content;
  if (res.content) return typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
  if (res.text) return res.text;
  if (res.data && res.data.content) return res.data.content;
  return '';
}

function extractJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function hitFromRule(rule, ageBand, extra = {}) {
  return {
    id: rule.id,
    domain: rule.domain,
    area: rule.area,
    goal: rule.goal,
    ageBand,
    typical: rule.typical[ageBand] || rule.typical['4-5岁'] || '',
    keywords: extra.keywords || [],
    reason: extra.reason || '',
    source: extra.source || 'ai',
    coa: rule.coa,
  };
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label || '超时')), ms)),
  ]);
}

async function generateText(messages) {
  const ai = cloud.extend && cloud.extend.AI;
  if (!ai || !ai.createModel) throw new Error('未开通云开发 AI');
  const provider = ai.createModel('cloudbase');
  let lastErr;
  for (const model of MODELS) {
    const data = { model, messages, temperature: 0.2 };
    try {
      if (typeof provider.generateText === 'function') {
        let res;
        try {
          res = await withTimeout(provider.generateText(data), 16000, 'AI 超时');
        } catch (err) {
          res = await withTimeout(provider.generateText({ data }), 16000, 'AI 超时');
        }
        const text = extractContent(res);
        if (text) return text;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('AI 无结果');
}

function mergeHits(ageBand, keywordHits, ids, reasons) {
  const byId = Object.fromEntries(GUIDE_RULES.map((r) => [r.id, r]));
  const keywordMap = Object.fromEntries((keywordHits || []).map((h) => [h.id, h]));
  const out = [];
  const seen = {};
  (ids || []).forEach((id) => {
    const rule = byId[id];
    if (!rule || seen[id]) return;
    seen[id] = true;
    const kw = keywordMap[id];
    out.push(
      hitFromRule(rule, ageBand, {
        keywords: kw ? kw.keywords : [],
        reason: (reasons && reasons[id]) || '',
        source: 'ai',
      }),
    );
  });
  (keywordHits || []).forEach((h) => {
    if (seen[h.id]) return;
    seen[h.id] = true;
    out.push(Object.assign({}, h, { source: h.source || 'rule', reason: h.reason || '' }));
  });
  return out.slice(0, 4);
}

async function aiMatch({ text, ageBand }) {
  const keywordHits = matchGuide(text, ageBand);
  const raw = String(text || '').trim();
  if (!raw) return { hits: [], interpret: '', source: 'rule' };
  try {
    const reply = await generateText([
      {
        role: 'system',
        content: '你是幼儿园观察记录助手。只返回 JSON。解读必须依据实录，不得编造实录里没有的情节。',
      },
      {
        role: 'user',
        content: [
          `年龄段：${ageBand}`,
          `实录：${raw.slice(0, 1200)}`,
          `可选《3—6岁指南》条目：${JSON.stringify(catalog())}`,
          '选出最相关的 1 到 4 条。',
          '返回：{"ids":["health-emotion"],"interpret":"两句以内发展解读","reasons":{"health-emotion":"对应理由"}}',
        ].join('\n'),
      },
    ]);
    const parsed = extractJson(reply) || {};
    const hits = mergeHits(ageBand, keywordHits, parsed.ids, parsed.reasons);
    return {
      hits,
      interpret: String(parsed.interpret || '').trim().slice(0, 220),
      source: hits.some((h) => h.source === 'ai') ? 'ai' : 'rule',
    };
  } catch {
    return {
      hits: keywordHits.map((h) => Object.assign({}, h, { source: 'rule' })),
      interpret: '',
      source: 'rule',
    };
  }
}

async function aiSummarize({ childName, className, observations }) {
  const rows = (observations || [])
    .slice(0, 12)
    .map((o, i) => `${i + 1}. ${String(o.at || '').slice(0, 16)} ${String(o.text || '').slice(0, 160)}`);
  if (!rows.length) return { interpret: '' };
  try {
    const reply = await generateText([
      {
        role: 'system',
        content: '你是幼儿园教研助手。根据观察实录写阶段性综述。只写实录能支撑的判断，不贴标签、不编造。只返回纯文本。',
      },
      {
        role: 'user',
        content: `幼儿：${childName || ''}　班级：${className || ''}\n观察摘录：\n${rows.join('\n')}\n请写 80 到 140 字综述，点出反复出现的行为与《指南》相关领域，不要出现“该生”“赋能”等套话。`,
      },
    ]);
    return { interpret: String(reply || '').replace(/\s+/g, ' ').trim().slice(0, 220) };
  } catch {
    return { interpret: '' };
  }
}

module.exports = { aiMatch, aiSummarize };
