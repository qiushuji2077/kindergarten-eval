import { probeLiveApi, staticApi } from './staticApi';

export type ClassItem = {
  id: string;
  name: string;
  child_count?: number;
  teacher_count?: number;
};

export type Teacher = {
  id: string;
  name: string;
  phone?: string;
  class_id?: string;
};

export type Child = {
  id: string;
  name: string;
  class_id: string;
  class_name?: string;
  gender?: string;
  birthday?: string;
};

export type Stage = {
  id: string;
  level: number;
  description: string;
  key_point?: string;
  indicator_name?: string;
  domain_name?: string;
};

export type Indicator = {
  id: string;
  name: string;
  stages: Stage[];
};

export type Domain = {
  id: string;
  name: string;
  indicators: Indicator[];
};

export type MediaItem = {
  id: string;
  kind: 'photo' | 'video' | 'audio';
  filename: string;
  url: string;
  mime_type?: string;
};

export type GuideHit = {
  id: string;
  domain: string;
  area: string;
  goal: string;
  ageBand: string;
  typical: string;
  keywords: string[];
};

export type Observation = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  class_id: string;
  class_name: string;
  record_type: string;
  observed_at: string;
  narrative: string;
  voice_transcript?: string;
  created_at: string;
  children: Child[];
  stages: Stage[];
  media: MediaItem[];
  guideHits?: GuideHit[];
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function live() {
  return probeLiveApi();
}

export const api = {
  classes: async () =>
    (await live()) ? request<ClassItem[]>('/api/classes') : staticApi.classes(),
  teachers: async (classId?: string) =>
    (await live())
      ? request<Teacher[]>(`/api/teachers${classId ? `?classId=${classId}` : ''}`)
      : staticApi.teachers(classId),
  children: async (classId?: string) =>
    (await live())
      ? request<Child[]>(`/api/children${classId ? `?classId=${classId}` : ''}`)
      : staticApi.children(classId),
  framework: async () =>
    (await live()) ? request<Domain[]>('/api/framework') : staticApi.framework(),
  observations: async (params: { classId?: string; childId?: string } = {}) => {
    if (!(await live())) return staticApi.observations(params);
    const q = new URLSearchParams();
    if (params.classId) q.set('classId', params.classId);
    if (params.childId) q.set('childId', params.childId);
    q.set('limit', '80');
    return request<Observation[]>(`/api/observations?${q}`);
  },
  createChild: async (body: { name: string; classId: string; gender?: string; birthday?: string }) =>
    (await live())
      ? request<Child>('/api/children', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : staticApi.createChild(body),
  createClass: async (name: string) =>
    (await live())
      ? request<ClassItem>('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
      : staticApi.createClass(),
  createTeacher: async (body: { name: string; phone?: string; classId?: string }) =>
    (await live())
      ? request<Teacher>('/api/teachers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : staticApi.createTeacher(),
  createObservation: async (form: FormData) =>
    (await live())
      ? request<Observation>('/api/observations', { method: 'POST', body: form })
      : staticApi.createObservation(form),
  matchGuide: async (body: {
    text: string;
    classId?: string;
    childIds?: string[];
    observedAt?: string;
  }) =>
    (await live())
      ? request<{ ageBand: string; hits: GuideHit[] }>('/api/guide/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : staticApi.matchGuide(body),
  previewReport: async (childId: string, opts: { from?: string; to?: string } = {}) => {
    if (!(await live())) return staticApi.previewReport(childId);
    const q = new URLSearchParams();
    if (opts.from) q.set('from', opts.from);
    if (opts.to) q.set('to', opts.to);
    const s = q.toString();
    return request<{ meta: { total: number; coaCount: number; from: string; to: string } }>(
      `/api/reports/child/${childId}/preview${s ? `?${s}` : ''}`,
    );
  },
  downloadReport: async (childId: string, childName: string, kindergartenName: string) => {
    if (!(await live())) {
      return staticApi.downloadReport(childId, childName, kindergartenName);
    }
    const q = new URLSearchParams();
    if (kindergartenName) q.set('kindergartenName', kindergartenName);
    const s = q.toString();
    const res = await fetch(
      `/api/reports/child/${encodeURIComponent(childId)}/docx${s ? `?${s}` : ''}`,
    );
    if (!res.ok) throw new Error('生成失败');
    const blob = await res.blob();
    return new File([blob], `${childName}-观察记录汇总.docx`, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  },
};
