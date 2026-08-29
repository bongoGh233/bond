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
    if (error || !data) return [];
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
  return [];
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  if (isBackendConfigured && supabase) {
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId).eq('user_id', userId);
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (isBackendConfigured && supabase) {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
  }
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
  return null;
}