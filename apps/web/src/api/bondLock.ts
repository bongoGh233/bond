import { supabase, isBackendConfigured } from '../supabase';

export type BondAccessMode = 'one_time' | 'time_limited' | 'each_time';
export type BondStatus = 'granted' | 'revoked' | 'denied' | 'expired';

export interface BondLockItem {
  id: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderBondId: string;
  senderAvatarStyle: number;
  senderAvatarColor: number;
  content: string;
  accessMode: BondAccessMode;
  accessToken?: string;
  createdAt: string;
  expiresAt?: string;
  isMine: boolean;
  status: BondStatus;
  remainUses?: number;
}

interface SenderEmbed {
  id: string;
  display_name: string;
  bond_id: string;
  avatar_style: number | null;
  avatar_color: number | null;
}

interface MessageEmbed {
  id: string;
  content: string;
  created_at: string;
}

interface BondGrantRow {
  id: string;
  message_id: string;
  sender_id: string;
  access_mode: BondAccessMode;
  access_token: string | null;
  granted_at: string | null;
  expires_at: string | null;
  remain_uses: number | null;
  status: BondStatus;
  sender: SenderEmbed | null;
  message: MessageEmbed | null;
}

/* ================================================================== */
/* Preview-mode demo data                                             */
/* ================================================================== */

let previewLocks: BondLockItem[] = [
  {
    id: 'bl-1',
    messageId: 'pm-lock-1',
    senderId: 'p-alice',
    senderName: 'Alice',
    senderBondId: 'alice',
    senderAvatarStyle: 0,
    senderAvatarColor: 0,
    content: '🔒 A private note — photo of our surprise for Friday. Unlock to reveal.',
    accessMode: 'one_time',
    accessToken: 'BOND-ALPHA',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    isMine: false,
    status: 'granted',
    remainUses: 1,
  },
  {
    id: 'bl-2',
    messageId: 'pm-lock-2',
    senderId: 'you',
    senderName: 'You',
    senderBondId: 'bond_demo',
    senderAvatarStyle: 0,
    senderAvatarColor: 0,
    content: '🔐 The itinerary — locked for Ben.',
    accessMode: 'time_limited',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    isMine: true,
    status: 'granted',
    remainUses: 3,
  },
];

let previewId = 10;

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */

export async function listBondLocks(userId: string): Promise<BondLockItem[]> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { data, error } = await client
      .from('bond_lock_grants')
      .select(
        'id, message_id, sender_id, access_mode, access_token, granted_at, expires_at, remain_uses, status, ' +
          'sender:profiles!bond_lock_grants_sender_id_fkey(id, display_name, bond_id, avatar_style, avatar_color), ' +
          'message:messages!bond_lock_grants_message_id_fkey(id, content, created_at)'
      )
      .or(`sender_id.eq.${userId},grantee_id.eq.${userId}`);
    if (error || !data) return previewLocks.slice();
    const items: BondLockItem[] = [];
    for (const row of data as unknown as BondGrantRow[]) {
      const sender = row.sender;
      items.push({
        id: row.id,
        messageId: row.message_id,
        senderId: row.sender_id,
        senderName: sender?.display_name ?? 'Unknown',
        senderBondId: sender?.bond_id ?? '',
        senderAvatarStyle: sender?.avatar_style ?? 0,
        senderAvatarColor: sender?.avatar_color ?? 0,
        content: row.message?.content ?? '',
        accessMode: row.access_mode,
        accessToken: row.access_token ?? undefined,
        createdAt: row.granted_at ?? row.message?.created_at ?? new Date().toISOString(),
        expiresAt: row.expires_at ?? undefined,
        isMine: row.sender_id === userId,
        status: row.status,
        remainUses: row.remain_uses ?? undefined,
      });
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return previewLocks.slice();
}

export async function listMyBondLocks(userId: string): Promise<BondLockItem[]> {
  return (await listBondLocks(userId)).filter((i) => i.isMine);
}

export async function listIncomingBondLocks(userId: string): Promise<BondLockItem[]> {
  return (await listBondLocks(userId)).filter((i) => !i.isMine && i.status === 'granted');
}

/** Find (or create) the direct conversation between two users (Supabase only). */
async function getOrCreateConversation(userId: string, otherId: string): Promise<{ id: string } | { error: string }> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { data: mine } = await client.from('conversation_members').select('conversation_id').eq('user_id', userId);
    const { data: theirs } = await client.from('conversation_members').select('conversation_id').eq('user_id', otherId);
    const shared = (mine ?? []).map((m) => m.conversation_id as string).filter((id) => (theirs ?? []).some((t) => t.conversation_id === id));
    if (shared.length > 0) return { id: shared[0] };

    const { data, error } = await client.from('conversations').insert({ is_group: false, created_by: userId }).select('id').single();
    if (error || !data) return { error: error?.message ?? 'Failed to create conversation' };
    const id = data.id as string;
    const { error: e1 } = await client.from('conversation_members').insert({ conversation_id: id, user_id: userId });
    const { error: e2 } = await client.from('conversation_members').insert({ conversation_id: id, user_id: otherId });
    if (e1 || e2) return { error: e1?.message ?? e2?.message ?? 'Failed to add members' };
    return { id };
  }
  return { id: `pc-${otherId}` };
}

export async function createBondLock(
  userId: string,
  recipientId: string,
  content: string,
  mode: BondAccessMode,
  durationHours?: number
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: 'Add some protected content first' };
  if (!recipientId) return { ok: false, error: 'Choose who to bond-lock this for' };

  if (isBackendConfigured && supabase) {
    const client = supabase;
    const expiresAt = mode === 'time_limited' && durationHours
      ? new Date(Date.now() + durationHours * 3600_000).toISOString()
      : undefined;

    const convo = await getOrCreateConversation(userId, recipientId);
    if ('error' in convo) return { ok: false, error: convo.error };

    const { data: message, error: mErr } = await client
      .from('messages')
      .insert({
        conversation_id: convo.id,
        sender_id: userId,
        type: 'text',
        content: trimmed,
        status: 'sent',
        bond_lock: true,
      })
      .select('id')
      .single();
    if (mErr || !message) return { ok: false, error: mErr?.message ?? 'Failed to lock message' };
    const created = message as { id: string };

    const { error: gErr } = await client.from('bond_lock_grants').insert({
      message_id: created.id,
      sender_id: userId,
      grantee_id: recipientId,
      access_mode: mode,
      access_token: `BOND-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      expires_at: expiresAt ?? null,
      remain_uses: mode === 'one_time' ? 1 : mode === 'time_limited' ? 5 : null,
      status: 'granted',
    });
    if (gErr) return { ok: false, error: gErr.message };
    return { ok: true };
  }

  previewLocks.unshift({
    id: `bl-${previewId++}`,
    messageId: `pm-lock-${previewId}`,
    senderId: userId,
    senderName: 'You',
    senderBondId: 'bond_demo',
    senderAvatarStyle: 0,
    senderAvatarColor: 0,
    content: trimmed,
    accessMode: mode,
    accessToken: `BOND-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    expiresAt: mode === 'time_limited' && durationHours
      ? new Date(Date.now() + durationHours * 3600_000).toISOString()
      : undefined,
    isMine: true,
    status: 'granted',
    remainUses: mode === 'one_time' ? 1 : mode === 'time_limited' ? 5 : undefined,
  });
  return { ok: true };
}

export async function unlockBond(userId: string, grantId: string): Promise<{ ok: boolean; content?: string; error?: string }> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    interface GrantUpdateRow {
      id: string;
      message_id: string;
      status: BondStatus;
      access_mode: BondAccessMode;
      remain_uses: number | null;
    }
    const { data: grant, error: getErr } = await client
      .from('bond_lock_grants')
      .select('id, message_id, status, access_mode, remain_uses')
      .eq('id', grantId)
      .eq('grantee_id', userId)
      .single();
    const g = grant as GrantUpdateRow | null;
    if (getErr || !g) return { ok: false, error: getErr?.message ?? 'Grant not found' };
    if (g.status !== 'granted') return { ok: false, error: 'This bond is no longer available' };

    const nextUses = g.remain_uses == null ? null : Math.max(0, g.remain_uses - 1);
    const status: BondStatus =
      g.access_mode === 'one_time' || (nextUses !== null && nextUses <= 0) ? 'expired' : 'granted';

    const { error: uErr } = await client.from('bond_lock_grants').update({ status, remain_uses: nextUses }).eq('id', grantId);
    if (uErr) return { ok: false, error: uErr?.message ?? 'Failed to unlock' };

    const { data: locked } = await client.from('messages').select('content').eq('id', g.message_id).single();
    const contentRow = locked as { content: string } | null;
    return { ok: true, content: contentRow?.content ?? '' };
  }

  const item = previewLocks.find((i) => i.id === grantId);
  if (!item) return { ok: false, error: 'Grant not found' };
  if (item.status !== 'granted') return { ok: false, error: 'This bond is no longer available' };
  if (item.accessMode === 'one_time' || (item.remainUses !== undefined && item.remainUses <= 1)) {
    item.status = 'expired';
    item.remainUses = 0;
  } else if (item.remainUses !== undefined) {
    item.remainUses -= 1;
  }
  return { ok: true, content: item.content };
}

export async function revokeBond(userId: string, grantId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { error } = await client.from('bond_lock_grants').update({ status: 'revoked' }).eq('id', grantId).eq('sender_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const item = previewLocks.find((i) => i.id === grantId && i.isMine);
  if (item) item.status = 'revoked';
  return { ok: true };
}