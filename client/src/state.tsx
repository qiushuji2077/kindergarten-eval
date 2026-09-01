import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type Child, type ClassItem, type Domain, type Teacher } from './api';

type Session = {
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  kindergartenName?: string;
};

type AppState = {
  loading: boolean;
  error: string | null;
  classes: ClassItem[];
  teachers: Teacher[];
  children: Child[];
  framework: Domain[];
  session: Session | null;
  setSession: (s: Session) => void;
  clearSession: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);
const SESSION_KEY = 'kg-eval-session';
const PICK_KEY = 'kg-eval-pick-teacher';

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [kids, setKids] = useState<Child[]>([]);
  const [framework, setFramework] = useState<Domain[]>([]);
  const [session, setSessionState] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const refresh = async () => {
    setError(null);
    const [c, t, ch, f] = await Promise.all([
      api.classes(),
      api.teachers(),
      api.children(),
      api.framework(),
    ]);
    setClasses(c);
    setTeachers(t);
    setKids(ch);
    setFramework(f);
    return { c, t };
  };

  useEffect(() => {
    refresh()
      .then(({ c, t }) => {
        try {
          if (localStorage.getItem(SESSION_KEY) || localStorage.getItem(PICK_KEY)) return;
        } catch {
          // ignore
        }
        const cls = c.find((x) => x.name === '中二班') || c[0];
        const classTeachers = t.filter((x) => !cls || x.class_id === cls.id);
        const teacher =
          classTeachers.find((x) => x.name === '杨飞') || classTeachers[0] || t[0];
        if (!cls || !teacher) return;
        setSession({
          classId: cls.id,
          className: cls.name,
          teacherId: teacher.id,
          teacherName: teacher.name,
          kindergartenName: localStorage.getItem('kg-eval-kindergarten') || '',
        });
      })
      .catch((e) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const setSession = (s: Session) => {
    setSessionState(s);
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    localStorage.removeItem(PICK_KEY);
  };

  const clearSession = () => {
    setSessionState(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.setItem(PICK_KEY, '1');
  };

  const value = useMemo(
    () => ({
      loading,
      error,
      classes,
      teachers,
      children: kids,
      framework,
      session,
      setSession,
      clearSession,
      refresh,
    }),
    [loading, error, classes, teachers, kids, framework, session],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
