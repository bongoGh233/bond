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

    // Server-enforced (migration 0006): content lives in bond_lock_payloads
    // (no SELECT policy), grants are created atomically with the lock message.
    const { error } = await client.rpc('create_bond_lock', {
      p_conversation_id: convo.id,
      p_grantee_id: recipientId,
      p_content: trimmed,
      p_access_mode: mode,
      p_expires_at: expiresAt ?? null,
      p_remain_uses: mode === 'one_time' ? 1 : mode === 'time_limited' ? 5 : null,
    });
    if (error) return { ok: false, error: error.message };
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

export async function unlockBond(_userId: string, grantId: string): Promise<{ ok: boolean; content?: string; error?: string }> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { data, error } = await client.rpc('unlock_bond_grant', { p_grant_id: grantId });
    if (error) return { ok: false, error: error.message };
    const payload = data as { content?: string } | null;
    return { ok: true, content: payload?.content ?? '' };
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

export async function revokeBond(_userId: string, grantId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { error } = await client.rpc('revoke_bond_lock', { p_grant_id: grantId });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const item = previewLocks.find((i) => i.id === grantId && i.isMine);
  if (item) item.status = 'revoked';
  return { ok: true };
}