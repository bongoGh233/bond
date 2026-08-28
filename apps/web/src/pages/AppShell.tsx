import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import { listNotifications } from '../api/notifications';

const navItems = [
  { to: '/app', label: 'Chats', end: true, ico: '💬' },
  { to: '/app/moments', label: 'Moments', ico: '✨' },
  { to: '/app/connections', label: 'Connections', ico: '👥' },
  { to: '/app/shared', label: 'Shared Space', ico: '📖' },
  { to: '/app/bond-lock', label: 'Bond Lock', ico: '🔒' },
  { to: '/app/surprise-box', label: 'Surprise Box', ico: '🎁' },
  { to: '/app/i-need-you', label: 'I Need You', ico: '🚨' },
  { to: '/app/voice-diary', label: 'Voice Diary', ico: '🎙️' },
  { to: '/app/notifications', label: 'Notifications', ico: '🔔' },
  { to: '/app/settings', label: 'Settings', ico: '⚙️' },
];

export function AppShell() {
  const { session, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    const items = await listNotifications(session?.userId ?? 'you');
    setUnread(items.filter((n) => !n.read).length);
  }, [session?.userId]);

  useEffect(() => {
    loadUnread();
    const t = window.setInterval(loadUnread, 30000);
    return () => window.clearInterval(t);
  }, [loadUnread]);

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
              {n.to === '/app/notifications' && unread > 0 ? (
                <span className="pill pill-gold" style={{ marginLeft: 'auto', fontSize: '.72rem' }}>{unread}</span>
              ) : null}
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