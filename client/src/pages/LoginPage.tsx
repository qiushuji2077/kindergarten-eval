import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../state';

export function LoginPage() {
  const { classes, teachers, setSession } = useApp();
  const [classId, setClassId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [kindergartenName, setKindergartenName] = useState(
    () => localStorage.getItem('kg-eval-kindergarten') || '',
  );

  useEffect(() => {
    if (!classId && classes[0]) setClassId(classes[0].id);
  }, [classes, classId]);

  const classTeachers = useMemo(
    () => teachers.filter((t) => !classId || t.class_id === classId),
    [teachers, classId],
  );

  useEffect(() => {
    if (!classTeachers.some((t) => t.id === teacherId)) {
      setTeacherId(classTeachers[0]?.id || '');
    }
  }, [classTeachers, teacherId]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cls = classes.find((c) => c.id === classId);
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!cls || !teacher) return;
    setSession({
      classId: cls.id,
      className: cls.name,
      teacherId: teacher.id,
      teacherName: teacher.name,
      kindergartenName: kindergartenName.trim(),
    });
    localStorage.setItem('kg-eval-kindergarten', kindergartenName.trim());
  };

  return (
    <form className="login-wrap" onSubmit={onSubmit}>
      <h1>观察</h1>
      <p className="lead">中二班记录入口。园所名称写入报告封面，可不填。</p>

      <div className="section-label">园所名称</div>
      <div className="group">
        <label className="cell">
          <span className="name">园所</span>
          <input
            className="field-input"
            value={kindergartenName}
            placeholder="不填则封面只写「幼儿园」"
            onChange={(e) => setKindergartenName(e.target.value)}
          />
        </label>
      </div>

      <div className="section-label">班级</div>
      <div className="group">
        {classes.map((c) => (
          <button
            type="button"
            key={c.id}
            className="cell"
            onClick={() => setClassId(c.id)}
          >
            <span className="name">{c.name}</span>
            {classId === c.id && <span className="export-count">已选</span>}
          </button>
        ))}
      </div>

      <div className="section-label">教师</div>
      <div className="group">
        {classTeachers.map((t) => (
          <button
            type="button"
            key={t.id}
            className="cell"
            onClick={() => setTeacherId(t.id)}
          >
            <span className="name">{t.name}</span>
            {teacherId === t.id && <span className="export-count">已选</span>}
          </button>
        ))}
      </div>

      <button className="btn-block" type="submit" disabled={!classId || !teacherId}>
        进入
      </button>
    </form>
  );
}
