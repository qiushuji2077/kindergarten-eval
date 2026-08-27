import { useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../state';

export function AdminPage() {
  const { children, session } = useApp();
  const [from, setFrom] = useState('2026-03-04');
  const [to, setTo] = useState('2026-07-10');
  const [kgName, setKgName] = useState(session?.kindergartenName || '');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(
    () => children.filter((c) => !session?.classId || c.class_id === session.classId),
    [children, session],
  );

  const exportChild = async (childId: string) => {
    setError(null);
    setBusyId(childId);
    try {
      const data = await api.previewReport(childId, {
        from: from || undefined,
        to: to || undefined,
      });
      if (!data.meta.total) {
        setError('这个日期范围内没有记录');
        return;
      }
      window.location.href = api.reportUrl(childId, {
        from: from || undefined,
        to: to || undefined,
        kindergartenName: kgName.trim() || '幼儿园',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setBusyId(null);
    }
  };

  const switchTeacher = () => {
    localStorage.removeItem('kg-eval-session');
    window.location.href = '/';
  };

  return (
    <div className="page">
      <header className="ios-header">
        <div className="ios-title-row">
          <h1>导出</h1>
        </div>
      </header>

      <div className="section-label">报告区间</div>
      <div className="group">
        <label className="cell">
          <span className="name">幼儿园</span>
          <input className="field-input" value={kgName} onChange={(e) => setKgName(e.target.value)} />
        </label>
        <label className="cell">
          <span className="name">开始</span>
          <input className="field-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="cell">
          <span className="name">截止</span>
          <input className="field-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <div className="section-label">按幼儿导出 Word</div>
      <div className="group">
        {list.map((c) => (
          <button type="button" className="cell" key={c.id} onClick={() => exportChild(c.id)}>
            <div className="left">
              <span className="name">{c.name}</span>
              <span className="sub">{c.class_name}</span>
            </div>
            <span className="export-count">{busyId === c.id ? '生成中' : '导出'}</span>
          </button>
        ))}
      </div>
      {error && <div className="error-banner">{error}</div>}
      <p className="hint">当前 {session?.teacherName} · {session?.className}</p>
      <button type="button" className="btn-block gray" onClick={switchTeacher}>
        切换教师
      </button>
    </div>
  );
}
