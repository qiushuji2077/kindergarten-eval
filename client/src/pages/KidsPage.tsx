import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useApp } from '../state';

export function KidsPage() {
  const { session, children, refresh } = useApp();
  const [name, setName] = useState('');
  const [gender, setGender] = useState('女');
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(
    () => children.filter((c) => c.class_id === session?.classId),
    [children, session],
  );

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || !name.trim()) return;
    setError(null);
    try {
      await api.createChild({
        name: name.trim(),
        classId: session.classId,
        gender,
      });
      setName('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    }
  };

  return (
    <div className="page">
      <header className="ios-header">
        <div className="ios-title-row">
          <h1>幼儿</h1>
        </div>
      </header>

      <div className="section-label">{session?.className} · {list.length}人</div>
      <div className="group">
        {list.map((c) => (
          <div className="cell" key={c.id}>
            <div className="left">
              <span className="name">{c.name}</span>
              <span className="sub">
                {c.gender || '未填'}
                {c.birthday ? ` · ${c.birthday}` : ''}
              </span>
            </div>
          </div>
        ))}
        {!list.length && <div className="empty">本班还没有幼儿</div>}
      </div>

      <form onSubmit={onAdd}>
        <div className="section-label">添加幼儿</div>
        <div className="group">
          <label className="cell">
            <span className="name">姓名</span>
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="小麦"
              required
            />
          </label>
          <label className="cell">
            <span className="name">性别</span>
            <select className="field-input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="女">女</option>
              <option value="男">男</option>
            </select>
          </label>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <button className="btn-block" type="submit">
          添加到本班
        </button>
      </form>
    </div>
  );
}
