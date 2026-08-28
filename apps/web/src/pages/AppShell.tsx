import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';

const navItems = [
  { to: '/app', label: 'Chats', end: true, ico: '💬' },
  { to: '/app/moments', label: 'Moments', ico: '✨' },
  { to: '/app/connections', label: 'Connections', ico: '👥' },
  { to: '/app/shared', label: 'Shared Space', ico: '📖' },
  { to: '/app/settings', label: 'Settings', ico: '⚙️' },
];

export function AppShell() {
  const { session, logout } = useAuth();
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand"><span className="brand-mark">♥</span> Bond</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <span className="ico">{n.ico}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={session?.displayName || 'You'} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {session?.displayName || 'You'}
            </div>
            <div className="muted" style={{ fontSize: '.78rem' }}>@{session?.bondId || 'you'}</div>
          </div>
          <button className="btn btn-danger" onClick={logout} title="Log out" style={{ padding: '8px 12px', width: 'auto' }}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
