import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from '../api/notifications';
import { timeAgo } from '../utils';

const TYPE_ICONS: Record<NotificationType, string> = {
  message: '💬',
  connection: '👥',
  moment: '✨',
  shared: '📖',
  bond_lock: '🔒',
  surprise: '🎁',
  i_need_you: '🚨',
};

const TYPE_ROUTES: Record<NotificationType, string> = {
  message: '/app',
  connection: '/app/connections',
  moment: '/app/moments',
  shared: '/app/shared',
  bond_lock: '/app/bond-lock',
  surprise: '/app/surprise-box',
  i_need_you: '/app/i-need-you',
};

export function Notifications() {
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const nav = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    setItems(await listNotifications(me));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationRead(me, n.id);
      await load();
    }
    nav(TYPE_ROUTES[n.type] ?? '/app');
  };

  const readAll = async () => {
    await markAllNotificationsRead(me);
    await load();
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="content" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            Notifications{unread > 0 ? <span className="pill pill-gold" style={{ marginLeft: 10 }}>{unread} new</span> : null}
          </h1>
          <p className="muted" style={{ fontSize: '.85rem' }}>Everything Bond surfaced for you, from messages to moments.</p>
        </div>
        {unread > 0 ? (
          <button className="btn btn-secondary" style={{ padding: '9px 16px', width: 'auto' }} onClick={readAll}>
            Mark all read
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">🔔</div>
            <h3>All caught up</h3>
            <p>New activities will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          {items.map((n) => (
            <div
              key={n.id}
              className="row"
              onClick={() => open(n)}
              style={{ opacity: n.read ? .72 : 1 }}
            >
              <span className="row-icon">{TYPE_ICONS[n.type] ?? '🔔'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.read ? 500 : 700, fontSize: '.93rem' }}>
                  {n.title}
                  {!n.read ? (
                    <span className="status-dot" style={{ background: 'var(--primary)', marginLeft: 8, verticalAlign: 'middle' }} />
                  ) : null}
                </div>
                <div className="muted" style={{ fontSize: '.82rem' }}>{n.body}</div>
              </div>
              <span className="muted" style={{ fontSize: '.76rem', flexShrink: 0 }}>{timeAgo(n.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}