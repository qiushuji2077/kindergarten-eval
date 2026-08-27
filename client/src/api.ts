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

export const api = {
  classes: () => request<ClassItem[]>('/api/classes'),
  teachers: (classId?: string) =>
    request<Teacher[]>(`/api/teachers${classId ? `?classId=${classId}` : ''}`),
  children: (classId?: string) =>
    request<Child[]>(`/api/children${classId ? `?classId=${classId}` : ''}`),
  framework: () => request<Domain[]>('/api/framework'),
  observations: (params: { classId?: string; childId?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.classId) q.set('classId', params.classId);
    if (params.childId) q.set('childId', params.childId);
    q.set('limit', '80');
    const s = q.toString();
    return request<Observation[]>(`/api/observations?${s}`);
  },
  createChild: (body: { name: string; classId: string; gender?: string; birthday?: string }) =>
    request<Child>('/api/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  createClass: (name: string) =>
    request<ClassItem>('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  createTeacher: (body: { name: string; phone?: string; classId?: string }) =>
    request<Teacher>('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  createObservation: (form: FormData) =>
    request<Observation>('/api/observations', { method: 'POST', body: form }),
  matchGuide: (body: { text: string; classId?: string; childIds?: string[]; observedAt?: string }) =>
    request<{ ageBand: string; hits: GuideHit[] }>('/api/guide/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  reportUrl: (childId: string, opts: { from?: string; to?: string; kindergartenName?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.from) q.set('from', opts.from);
    if (opts.to) q.set('to', opts.to);
    if (opts.kindergartenName) q.set('kindergartenName', opts.kindergartenName);
    const s = q.toString();
    return `/api/reports/child/${encodeURIComponent(childId)}/docx${s ? `?${s}` : ''}`;
  },
  previewReport: (childId: string, opts: { from?: string; to?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.from) q.set('from', opts.from);
    if (opts.to) q.set('to', opts.to);
    const s = q.toString();
    return request<{ meta: { total: number; coaCount: number; from: string; to: string } }>(
      `/api/reports/child/${childId}/preview${s ? `?${s}` : ''}`,
    );
  },
};
