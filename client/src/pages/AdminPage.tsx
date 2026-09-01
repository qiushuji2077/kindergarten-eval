import { useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../state';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AdminPage() {
  const { children, session, clearSession } = useApp();
  const [kgName, setKgName] = useState(session?.kindergartenName || '');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'collect' | 'write' | 'done'>('collect');
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(
    () => children.filter((c) => !session?.classId || c.class_id === session.classId),
    [children, session],
  );

  const exportChild = async (childId: string, name: string) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    setPhase('collect');
    try {
      const data = await api.previewReport(childId);
      if (!data.meta.total) {
        setError('还没有可导出的观察。先去记一条。');
        return;
      }
      setPhase('write');
      const file = await api.downloadReport(childId, name, kgName.trim() || '幼儿园');
      setPhase('done');
      await wait(700);
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `${name}观察记录汇总` });
      } else {
        const href = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = href;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(href);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setBusy(false);
    }
  };

  const switchTeacher = () => {
    clearSession();
  };

  return (
    <div className="page">
      <header className="ios-header">
        <div className="ios-title-row">
          <h1>导出</h1>
        </div>
        <p className="lead" style={{ margin: '0 16px 8px' }}>
          点幼儿姓名后生成 Word。手机可发给文件传输助手或存到本机。
        </p>
      </header>

      <div className="section-label">园所名称（写入报告封面）</div>
      <div className="group">
        <label className="cell">
          <span className="name">园所</span>
          <input
            className="field-input"
            value={kgName}
            placeholder="可不填"
            onChange={(e) => setKgName(e.target.value)}
          />
        </label>
      </div>

      <div className="section-label">按幼儿导出</div>
      <div className="group">
        {list.map((c) => (
          <button type="button" className="cell" key={c.id} onClick={() => exportChild(c.id, c.name)}>
            <div className="left">
              <span className="name">{c.name}</span>
              <span className="sub">{c.class_name}</span>
            </div>
            <span className="export-count">导出</span>
          </button>
        ))}
      </div>
      {error && <div className="error-banner">{error}</div>}
      <p className="hint">
        当前 {session?.teacherName} · {session?.className}
      </p>
      <button type="button" className="btn-block gray" onClick={switchTeacher}>
        切换教师
      </button>

      {busy && (
        <div className="export-mask">
          <div className="export-card">
            <div className={`write ${phase === 'done' ? 'done' : 'run'}`}>
              <div className="write-line l1" />
              <div className="write-line l2" />
              <div className="write-line l3" />
              {phase === 'done' ? <div className="write-ok">✓</div> : <div className="write-nib" />}
            </div>
            <div className="export-title">
              {phase === 'collect' ? '正在整理观察' : phase === 'write' ? '正在生成 Word' : '已经写好'}
            </div>
            <div className="export-sub">
              {phase === 'done' ? '接下来打开或发出文件' : '把这个孩子的记录收成一份汇总'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
