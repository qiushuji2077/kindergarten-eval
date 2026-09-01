import type { Child, ClassItem, Domain, GuideHit, Observation, Teacher } from './api';

type GuideRule = {
  id: string;
  domain: string;
  area: string;
  goal: string;
  keywords: string[];
  typical: Record<string, string> | string;
};

type StaticDb = {
  classes: ClassItem[];
  teachers: Teacher[];
  children: Child[];
  framework: Domain[];
  observations: Observation[];
  guide: GuideRule[];
};

type Overlay = {
  children: Child[];
  observations: Observation[];
};

const OVERLAY_KEY = 'kg-eval-static-overlay';

let seed: StaticDb | null = null;
let overlay: Overlay = { children: [], observations: [] };
let liveChecked = false;
let liveOk = false;

export async function probeLiveApi() {
  if (liveChecked) return liveOk;
  liveChecked = true;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 600);
  try {
    const res = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal });
    liveOk = res.ok;
  } catch {
    liveOk = false;
  } finally {
    window.clearTimeout(timer);
  }
  return liveOk;
}

function loadOverlay(): Overlay {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (!raw) return { children: [], observations: [] };
    const parsed = JSON.parse(raw);
    return {
      children: parsed.children || [],
      observations: parsed.observations || [],
    };
  } catch {
    return { children: [], observations: [] };
  }
}

function saveOverlay() {
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
  } catch {
    // quota
  }
}

async function db(): Promise<StaticDb> {
  if (!seed) {
    const res = await fetch('/static-db.json');
    if (!res.ok) throw new Error('示例数据加载失败');
    seed = (await res.json()) as StaticDb;
    overlay = loadOverlay();
  }
  return seed;
}

function nid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function ageBand(className?: string) {
  if (className?.includes('小')) return '3-4岁';
  if (className?.includes('大')) return '5-6岁';
  return '4-5岁';
}

function matchGuide(text: string, band: string, rules: GuideRule[]): GuideHit[] {
  const raw = text.trim();
  if (!raw) return [];
  const hits: GuideHit[] = [];
  for (const rule of rules) {
    const matched = [...new Set((rule.keywords || []).filter((k) => k && raw.includes(k)))];
    if (!matched.length) continue;
    const typical =
      typeof rule.typical === 'string' ? rule.typical : rule.typical?.[band] || '';
    hits.push({
      id: rule.id,
      domain: rule.domain,
      area: rule.area,
      goal: rule.goal,
      ageBand: band,
      typical,
      keywords: matched,
    });
  }
  return hits;
}

async function fileToUrl(file: File) {
  if (file.size > 1_500_000) return URL.createObjectURL(file);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读文件失败'));
    reader.readAsDataURL(file);
  });
}

export const staticApi = {
  classes: async () => (await db()).classes,
  teachers: async (classId?: string) => {
    const list = (await db()).teachers;
    return classId ? list.filter((t) => t.class_id === classId) : list;
  },
  children: async (classId?: string) => {
    const base = (await db()).children;
    const list = [...base, ...overlay.children];
    return classId ? list.filter((c) => c.class_id === classId) : list;
  },
  framework: async () => (await db()).framework,
  observations: async (params: { classId?: string; childId?: string } = {}) => {
    const base = (await db()).observations;
    let list = [...overlay.observations, ...base];
    if (params.classId) list = list.filter((o) => o.class_id === params.classId);
    if (params.childId) {
      list = list.filter((o) => o.children.some((c) => c.id === params.childId));
    }
    return list.slice(0, 80);
  },
  createChild: async (body: { name: string; classId: string; gender?: string; birthday?: string }) => {
    const data = await db();
    const cls = data.classes.find((c) => c.id === body.classId);
    const child: Child = {
      id: nid(),
      name: body.name,
      class_id: body.classId,
      class_name: cls?.name,
      gender: body.gender,
      birthday: body.birthday,
    };
    overlay.children.unshift(child);
    saveOverlay();
    return child;
  },
  createClass: async () => {
    throw new Error('网页演示版不新增班级');
  },
  createTeacher: async () => {
    throw new Error('网页演示版不新增教师');
  },
  createObservation: async (form: FormData) => {
    const data = await db();
    const teacherId = String(form.get('teacherId') || '');
    const classId = String(form.get('classId') || '');
    const teacher = data.teachers.find((t) => t.id === teacherId);
    const cls = data.classes.find((c) => c.id === classId);
    const childIds = JSON.parse(String(form.get('childIds') || '[]')) as string[];
    const allKids = [...data.children, ...overlay.children];
    const kids = allKids.filter((c) => childIds.includes(c.id));
    const files = form.getAll('media').filter((x): x is File => x instanceof File);
    const media = [];
    for (const file of files) {
      const url = await fileToUrl(file);
      media.push({
        id: nid(),
        kind: file.type.startsWith('video/')
          ? ('video' as const)
          : file.type.startsWith('audio/')
            ? ('audio' as const)
            : ('photo' as const),
        filename: file.name,
        url,
        mime_type: file.type,
      });
    }
    const narrative = String(form.get('narrative') || '');
    const band = ageBand(cls?.name);
    const obs: Observation = {
      id: nid(),
      teacher_id: teacherId,
      teacher_name: teacher?.name || '',
      class_id: classId,
      class_name: cls?.name || '',
      record_type: String(form.get('recordType') || 'COA记录'),
      observed_at: String(form.get('observedAt') || new Date().toISOString()),
      narrative,
      voice_transcript: String(form.get('voiceTranscript') || ''),
      created_at: new Date().toISOString(),
      children: kids,
      stages: [],
      media,
      guideHits: matchGuide(narrative, band, data.guide || []),
    };
    overlay.observations.unshift(obs);
    saveOverlay();
    return obs;
  },
  matchGuide: async (body: { text: string; classId?: string }) => {
    const data = await db();
    const cls = data.classes.find((c) => c.id === body.classId);
    const band = ageBand(cls?.name);
    return { ageBand: band, hits: matchGuide(body.text || '', band, data.guide || []) };
  },
  previewReport: async (childId: string) => {
    const list = await staticApi.observations({ childId });
    return {
      meta: {
        total: list.length,
        coaCount: list.length,
        from: list.at(-1)?.observed_at?.slice(0, 10) || '',
        to: list[0]?.observed_at?.slice(0, 10) || '',
      },
    };
  },
  downloadReport: async (childId: string, childName: string, kindergartenName: string) => {
    const list = await staticApi.observations({ childId });
    if (!list.length) throw new Error('还没有可导出的观察。先去记一条。');
    const kg = kindergartenName.trim() || '幼儿园';
    const blocks = list
      .map((o) => {
        const when = (o.observed_at || '').replace('T', ' ').slice(0, 16);
        const kids = o.children.map((c) => c.name).join('、');
        return `<h3>${when} · ${o.teacher_name} · ${kids}</h3><p>${(o.narrative || '').replace(/</g, '&lt;')}</p>`;
      })
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${childName}观察记录汇总</title></head><body>
      <h1>${kg}</h1><h2>${childName} 观察记录汇总</h2>${blocks}
    </body></html>`;
    return new File([`\ufeff${html}`], `${childName}-观察记录汇总.doc`, {
      type: 'application/msword',
    });
  },
};
