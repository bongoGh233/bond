import { supabase, isBackendConfigured } from '../supabase';

export type AlertStatus = 'pending' | 'acknowledged' | 'answered';
export type AckAction = 'im_here' | 'will_respond' | 'answered';

export interface INeedYouAlert {
  id: string;
  requester: {
    id: string;
    displayName: string;
    bondId: string;
    avatarStyle: number;
    avatarColor: number;
  };
  recipient: {
    id: string;
    displayName: string;
    bondId: string;
    avatarStyle: number;
    avatarColor: number;
  };
  message: string;
  status: AlertStatus;
  ackAction?: AckAction;
  ackedAt?: string;
  createdAt: string;
  forMe: boolean;
}

export interface INeedYouPrefs {
  optIn: boolean;
  quietHours: { enabled: boolean; start?: string; end?: string };
}

interface ProfileEmbed {
  id: string;
  display_name: string;
  bond_id: string;
  avatar_style: number | null;
  avatar_color: number | null;
}

interface IAlertRow {
  id: string;
  requester_id: string;
  recipient_id: string;
  message: string;
  status: AlertStatus;
  ack_action: AckAction | null;
  acked_at: string | null;
  created_at: string;
  requester: ProfileEmbed | null;
  recipient: ProfileEmbed | null;
}

function toProfile(p: ProfileEmbed): { id: string; displayName: string; bondId: string; avatarStyle: number; avatarColor: number } {
  return {
    id: p.id,
    displayName: p.display_name,
    bondId: p.bond_id,
    avatarStyle: p.avatar_style ?? 0,
    avatarColor: p.avatar_color ?? 0,
  };
}

/* ================================================================== */
/* Preview-mode demo data                                             */
/* ================================================================== */

let previewAlerts: INeedYouAlert[] = [
  {
    id: 'iny-1',
    requester: { id: 'p-alice', displayName: 'Alice', bondId: 'alice', avatarStyle: 0, avatarColor: 0 },
    recipient: { id: 'you', displayName: 'You', bondId: 'bond_demo', avatarStyle: 0, avatarColor: 0 },
    message: 'I need you — can you call me?',
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    forMe: true,
  },
];

let previewPrefs: INeedYouPrefs = { optIn: true, quietHours: { enabled: false } };

const previewAlertId = (() => {
  let n = 10;
  return () => `iny-${n++}`;
})();

export function previewRecipientName(recipientId: string): string {
  const known: Record<string, string> = { 'p-alice': 'Alice', 'p-ben': 'Ben', 'p-maya': 'Maya', 'p-rosa': 'Rosa' };
  return known[recipientId] ?? recipientId;
}

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */

export async function listINeedYouAlerts(userId: string): Promise<INeedYouAlert[]> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { data, error } = await client
      .from('i_need_you')
      .select(
        'id, requester_id, recipient_id, message, status, ack_action, acked_at, created_at, ' +
          'requester:requester_id(id, display_name, bond_id, avatar_style, avatar_color), ' +
          'recipient:recipient_id(id, display_name, bond_id, avatar_style, avatar_color)'
      )
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error || !data) return previewAlerts.slice();
    const items: INeedYouAlert[] = [];
    for (const row of data as unknown as IAlertRow[]) {
      if (!row.requester || !row.recipient) continue;
      items.push({
        id: row.id,
        requester: toProfile(row.requester),
        recipient: toProfile(row.recipient),
        message: row.message,
        status: row.status,
        ackAction: row.ack_action ?? undefined,
        ackedAt: row.acked_at ?? undefined,
        createdAt: row.created_at,
        forMe: row.recipient_id === userId,
      });
    }
    return items;
  }
  return previewAlerts.slice();
}

export async function getINeedYouPrefs(userId: string): Promise<INeedYouPrefs> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { data } = await client.from('i_need_you_prefs').select('opt_in, quiet_hours').eq('user_id', userId).maybeSingle();
    const row = data as { opt_in: boolean; quiet_hours: { enabled: boolean; start?: string; end?: string } } | null;
    if (row) return { optIn: row.opt_in, quietHours: row.quiet_hours ?? { enabled: false } };
    return { optIn: false, quietHours: { enabled: false } };
  }
  return previewPrefs;
}

export async function updateINeedYouPrefs(userId: string, prefs: INeedYouPrefs): Promise<void> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    await client.from('i_need_you_prefs').upsert({ user_id: userId, opt_in: prefs.optIn, quiet_hours: prefs.quietHours });
    return;
  }
  previewPrefs = prefs;
}

export async function sendINeedYouAlert(
  requesterId: string,
  recipientId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = message.trim();
  if (!trimmed) return { ok: false, error: 'Add a short message' };
  if (!recipientId) return { ok: false, error: 'Choose who to alert' };

  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { error } = await client.from('i_need_you').insert({ requester_id: requesterId, recipient_id: recipientId, message: trimmed, status: 'pending' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const recipientName = previewAlerts.find((a) => a.recipient.id === recipientId)?.recipient.displayName ?? previewRecipientName(recipientId);
  previewAlerts.unshift({
    id: previewAlertId(),
    requester: { id: requesterId, displayName: 'You', bondId: 'bond_demo', avatarStyle: 0, avatarColor: 0 },
    recipient: { id: recipientId, displayName: recipientName, bondId: recipientId, avatarStyle: 0, avatarColor: 0 },
    message: trimmed,
    status: 'pending',
    createdAt: new Date().toISOString(),
    forMe: false,
  });
  return { ok: true };
}

export async function acknowledgeAlert(userId: string, alertId: string, action: AckAction): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { error } = await client
      .from('i_need_you')
      .update({ status: action === 'answered' ? 'answered' : 'acknowledged', ack_action: action, acked_at: new Date().toISOString() })
      .eq('id', alertId)
      .eq('recipient_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const item = previewAlerts.find((a) => a.id === alertId && a.forMe);
  if (item) {
    item.status = action === 'answered' ? 'answered' : 'acknowledged';
    item.ackAction = action;
    item.ackedAt = new Date().toISOString();
  }
  return { ok: true };
}