import { supabase, isBackendConfigured } from './supabase';
import { getOrCreateConversation } from './messages';

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
  /** Cursor/locked content the sender protected. */
  content: string;
  accessMode: BondAccessMode;
  /** Token the recipient would need to unlock (prototype). */
  accessToken?: string;
  createdAt: string;
  expiresAt?: string;
  /** True if this is a bond granted to ME (to unlock). */
  isMine: boolean;
  status: BondStatus;
  /**
   * Remaining uses. For 'one_time', unlocking consumes the single use and
   * the item is marked as exhausted.
   */
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

/**
 * Bonds granted TO the current user (they need to be unlocked), plus bonds
 * the current user sent (their locked items). In other words: everything the
 * user can see via Bond Lock.
 */
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

/**
 * Preview-only helper used by the demo state so mutations are reflected.
 */
export async function listMyBondLocks(userId: string): Promise<BondLockItem[]> {
  const all = await listBondLocks(userId);
  return all.filter((i) => i.isMine);
}

export async function listIncomingBondLocks(userId: string): Promise<BondLockItem[]> {
  const all = await listBondLocks(userId);
  return all.filter((i) => !i.isMine && i.status === 'granted');
}

/**
 * Create a new Bond Lock protected message: a secret/note the sender locks,
 * granted to a single trusted connection.
 *
 * Server-enforced via the `create_bond_lock` SECURITY DEFINER RPC (migration
 * 0006): the content is stored in `bond_lock_payloads` (no SELECT policy) and
 * the lock message itself never contains it. The function validates
 * conversation membership, an accepted connection, and the access mode.
 */
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

    // The lock message must live inside a direct conversation with the
    // recipient (verified again inside the RPC).
    const convo = await getOrCreateConversation(userId, recipientId);
    if ('error' in convo) return { ok: false, error: convo.error };

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

/**
 * Unlock an incoming bond through the `unlock_bond_grant` RPC. The server
 * re-validates status/expiry, atomically decrements one_time uses, and returns
 * the protected content — the only way it can ever be read.
 */
export async function unlockBond(
  userId: string,
  grantId: string
): Promise<{ ok: boolean; content?: string; error?: string }> {
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

/**
 * Revoke a bond the current user sent (server-validated via `revoke_bond_lock`).
 */
export async function revokeBond(userId: string, grantId: string): Promise<{ ok: boolean; error?: string }> {
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
