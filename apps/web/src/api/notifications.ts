import { supabase, isBackendConfigured } from '../supabase';

export type NotificationType =
  | 'message'
  | 'connection'
  | 'moment'
  | 'shared'
  | 'bond_lock'
  | 'surprise'
  | 'i_need_you';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

function titleFor(type: string, payload: Record<string, unknown>): string {
  const name = typeof payload.display_name === 'string' ? payload.display_name : undefined;
  switch (type) {
    case 'message': return `${name ?? 'New'} · message`;
    case 'connection': return name ? `${name} wants to connect` : 'New connection';
    case 'moment': return name ? `${name} posted a moment` : 'New moment';
    case 'shared': return 'New memory in a shared space';
    case 'bond_lock': return name ? `${name} locked something for you` : 'Bond Lock request';
    case 'surprise': return name ? `${name} sent you a surprise` : 'A surprise is waiting';
    case 'i_need_you': return name ? `${name} needs you` : 'Urgent alert';
    default: return 'Bond update';
  }
}

function bodyFor(type: string, payload: Record<string, unknown>): string {
  const text = typeof payload.text === 'string' ? payload.text : undefined;
  if (text) return text;
  switch (type) {
    case 'message': return 'You have a new message.';
    case 'connection': return 'Open Connections to review the request.';
    case 'moment': return 'Tap to view their moment.';
    case 'shared': return 'A memory you can relive together.';
    case 'bond_lock': return 'Unlock it to reveal the protected content.';
    case 'surprise': return 'It is ready to open.';
    case 'i_need_you': return 'They are asking for your attention.';
    default: return '';
  }
}

/* ================================================================== */
/* Preview-mode demo data                                             */
/* ================================================================== */

let previewNotifications: AppNotification[] = [
  {
    id: 'n-1',
    type: 'i_need_you',
    title: 'Alice needs you',
    body: 'They are asking for your attention.',
    payload: { display_name: 'Alice', alert_id: 'iny-1' },
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  },
  {
    id: 'n-2',
    type: 'surprise',
    title: 'Alice sent you a surprise',
    body: 'A surprise box is waiting. It is not ready to open yet.',
    payload: { display_name: 'Alice', box_id: 'sb-1' },
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'n-3',
    type: 'connection',
    title: 'Maya wants to connect',
    body: 'Open Connections to review the request.',
    payload: { display_name: 'Maya' },
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: 'n-4',
    type: 'moment',
    title: 'Ben posted a moment',
    body: 'Sunset from the hike 🔥',
    payload: { display_name: 'Ben', moment_id: 'pmom-2', text: 'Sunset from the hike 🔥' },
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
];

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, payload, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error || !data) return previewNotifications.slice();
    return (data as unknown as NotificationRow[]).map((r) => ({
      id: r.id,
      type: (r.type as NotificationType) ?? 'message',
      title: titleFor(r.type, r.payload),
      body: bodyFor(r.type, r.payload),
      payload: r.payload,
      read: r.read,
      createdAt: r.created_at,
    }));
  }
  return previewNotifications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  if (isBackendConfigured && supabase) {
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId).eq('user_id', userId);
    return;
  }
  const n = previewNotifications.find((x) => x.id === notificationId);
  if (n) n.read = true;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (isBackendConfigured && supabase) {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
    return;
  }
  previewNotifications = previewNotifications.map((n) => ({ ...n, read: true }));
}

export async function createNotification(userId: string, type: NotificationType, payload: Record<string, unknown>): Promise<AppNotification | null> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase.from('notifications').insert({ user_id: userId, type, payload }).select('id, type, payload, read, created_at').single();
    if (error || !data) return null;
    const r = data as unknown as NotificationRow;
    return {
      id: r.id,
      type: r.type as NotificationType,
      title: titleFor(r.type, r.payload),
      body: bodyFor(r.type, r.payload),
      payload: r.payload,
      read: r.read,
      createdAt: r.created_at,
    };
  }
  const n: AppNotification = {
    id: `n-${Date.now()}`,
    type,
    title: titleFor(type, payload),
    body: bodyFor(type, payload),
    payload,
    read: false,
    createdAt: new Date().toISOString(),
  };
  previewNotifications.unshift(n);
  return n;
}