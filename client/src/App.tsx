import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './state';
import { LoginPage } from './pages/LoginPage';
import { FeedPage } from './pages/FeedPage';
import { ComposePage } from './pages/ComposePage';
import { KidsPage } from './pages/KidsPage';
import { AdminPage } from './pages/AdminPage';

function IconList() {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <rect x="1" y="2" width="2" height="2" />
      <rect x="5" y="2" width="10" height="2" />
      <rect x="1" y="7" width="2" height="2" />
      <rect x="5" y="7" width="10" height="2" />
      <rect x="1" y="12" width="2" height="2" />
      <rect x="5" y="12" width="10" height="2" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <rect x="4" y="1" width="4" height="4" />
      <rect x="3" y="6" width="6" height="2" />
      <rect x="2" y="8" width="8" height="7" />
      <rect x="11" y="3" width="3" height="3" />
      <rect x="10" y="7" width="5" height="6" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <rect x="2" y="5" width="9" height="10" />
      <rect x="4" y="7" width="5" height="2" />
      <rect x="4" y="10" width="5" height="2" />
      <rect x="10" y="1" width="5" height="2" />
      <rect x="13" y="1" width="2" height="5" />
      <rect x="8" y="4" width="2" height="2" />
      <rect x="10" y="2" width="2" height="2" />
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
