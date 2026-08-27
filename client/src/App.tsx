import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './state';
import { LoginPage } from './pages/LoginPage';
import { FeedPage } from './pages/FeedPage';
import { ComposePage } from './pages/ComposePage';
import { KidsPage } from './pages/KidsPage';
import { AdminPage } from './pages/AdminPage';

function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 7h11M8 12h11M8 17h11" />
      <circle cx="5" cy="7" r="0.8" fill="currentColor" />
      <circle cx="5" cy="12" r="0.8" fill="currentColor" />
      <circle cx="5" cy="17" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M4 19c.6-3 2.6-4.5 5-4.5S13.4 16 14 19" />
      <circle cx="16.5" cy="9" r="2.2" />
      <path d="M16 14.6c2.2.3 3.8 1.6 4.3 4.4" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3h6v6" />
      <path d="M20 3l-9 9" />
      <path d="M19 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function Shell() {
  const { loading, error, session } = useApp();
  const location = useLocation();
  const isCompose = location.pathname === '/compose';

  if (loading) return <div className="empty">正在打开</div>;
  if (error) {
    return (
      <div className="login-wrap">
        <h1>无法连接</h1>
        <p className="lead">{error}</p>
      </div>
    );
  }
  if (!session?.teacherId) return <LoginPage />;

  return (
    <div className={`app-shell ${isCompose ? 'compose' : ''}`}>
      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/compose" element={<ComposePage />} />
        <Route path="/kids" element={<KidsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isCompose && (
        <nav className="bottom-nav">
          <NavLink to="/" end>
            <IconList />
            记录
          </NavLink>
          <NavLink to="/kids">
            <IconPeople />
            幼儿
          </NavLink>
          <NavLink to="/admin">
            <IconExport />
            导出
          </NavLink>
        </nav>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
