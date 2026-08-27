import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api, type Observation } from '../api';
import { useApp } from '../state';

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

function dateLabel(iso: string) {
  const key = dateKey(iso);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  if (key === today) return '今天';
  if (key === yesterday) return '昨天';
  const [yy, mm, dd] = key.split('-');
  if (yy === String(now.getFullYear())) return `${Number(mm)}月${Number(dd)}日`;
  return `${yy}年${Number(mm)}月${Number(dd)}日`;
}

function childNames(obs: Observation) {
  return obs.children.map((c) => c.name).join('、') || '未指定';
}

function excerpt(obs: Observation) {
  return (obs.narrative || obs.voice_transcript || '').replace(/\s+/g, ' ').trim();
}

function thumbOf(obs: Observation) {
  return obs.media.find((m) => m.kind === 'photo' || m.kind === 'video') || null;
}

export function FeedPage() {
  const { session } = useApp();
  const [list, setList] = useState<Observation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    api
      .observations({ classId: session.classId })
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  const filtered = useMemo(() => {
    const needle = q.trim();
    if (!needle) return list;
    return list.filter((obs) => {
      const hay = `${childNames(obs)} ${excerpt(obs)} ${obs.teacher_name}`;
      return hay.includes(needle);
    });
  }, [list, q]);

  const groups = useMemo(() => {
    const map = new Map<string, Observation[]>();
    for (const obs of filtered) {
      const key = dateKey(obs.observed_at);
      const arr = map.get(key) || [];
      arr.push(obs);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="page">
      <header className="ios-header">
        <div className="ios-title-row">
          <h1>观察</h1>
          <Link to="/compose" className="ios-plus" aria-label="新建">
            +
          </Link>
        </div>
        <p className="lead" style={{ margin: '0 16px 8px' }}>
          {session?.kindergartenName || '未填写园所名称，报告封面只写「幼儿园」'}
        </p>
        <input
          className="ios-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索幼儿姓名"
        />
      </header>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="empty">加载中</div>}
      {!loading && !filtered.length && (
        <div className="empty">{q ? '没有匹配的记录' : '还没有观察记录'}</div>
      )}

      {groups.map(([key, items]) => (
        <section key={key}>
          <div className="section-label">{dateLabel(items[0].observed_at)}</div>
          <div className="group">
            {items.map((obs) => {
              const thumb = thumbOf(obs);
              const stage = obs.stages[0];
              return (
                <article className="row" key={obs.id}>
                  <div className="row-body">
                    <p className="row-title">{childNames(obs)}</p>
                    <p className="row-excerpt">{excerpt(obs) || '无文字实录'}</p>
                    <p className="row-meta">
                      {obs.teacher_name}
                      {obs.guideHits?.[0]
                        ? ` · ${obs.guideHits[0].domain}·${obs.guideHits[0].goal}`
                        : stage
                          ? ` · ${stage.indicator_name} ${stage.level}`
                          : ''}
                    </p>
                  </div>
                  {thumb ? (
                    thumb.kind === 'video' ? (
                      <video className="thumb" src={thumb.url} muted playsInline preload="metadata" />
                    ) : (
                      <img className="thumb" src={thumb.url} alt="" />
                    )
                  ) : (
                    <div className="thumb-fallback">无图</div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
