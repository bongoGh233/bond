import { supabase, isBackendConfigured } from '../supabase';

export interface ConnectionUser {
  id: string;
  displayName: string;
  bondId: string;
  avatarStyle: number;
  avatarColor: number;
  bio?: string;
}

export interface ConnectionRequest {
  id: string;
  user: ConnectionUser;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
}

export interface OutgoingRequest {
  id: string;
  user: ConnectionUser;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  bond_id: string;
  avatar_style: number | null;
  avatar_color: number | null;
  bio: string | null;
}

function toConnectionUser(p: ProfileRow): ConnectionUser {
  return {
    id: p.id,
    displayName: p.display_name,
    bondId: p.bond_id,
    avatarStyle: p.avatar_style ?? 0,
    avatarColor: p.avatar_color ?? 0,
    bio: p.bio ?? undefined,
  };
}

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */

export async function listConnections(userId: string): Promise<ConnectionUser[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('connections')
      .select(
        'user_a, user_b, profiles_a:profiles!connections_user_a_fkey(id, display_name, bond_id, avatar_style, avatar_color, bio), profiles_b:profiles!connections_user_b_fkey(id, display_name, bond_id, avatar_style, avatar_color, bio)'
      )
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq('status', 'accepted');
    if (error || !data) return [];
    const list: ConnectionUser[] = [];
    for (const row of data as Array<{ user_a: string; user_b: string; profiles_a: unknown; profiles_b: unknown }>) {
      const other =
        row.user_a === userId
          ? (row.profiles_b as unknown as ProfileRow)
          : (row.profiles_a as unknown as ProfileRow);
      if (other) list.push(toConnectionUser(other));
    }
    return list;
  }
  return [];
}

export async function listRequests(userId: string): Promise<{ incoming: ConnectionRequest[]; outgoing: OutgoingRequest[] }> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('connections')
      .select(
        'id, user_a, user_b, requested_by, created_at, profiles_a:profiles!connections_user_a_fkey(id, display_name, bond_id, avatar_style, avatar_color, bio), profiles_b:profiles!connections_user_b_fkey(id, display_name, bond_id, avatar_style, avatar_color, bio)'
      )
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq('status', 'pending');
    if (error || !data) return { incoming: [], outgoing: [] };
    const incoming: ConnectionRequest[] = [];
    const outgoing: OutgoingRequest[] = [];
    for (const row of data as Array<{ id: string; user_a: string; user_b: string; requested_by: string; created_at: string; profiles_a: unknown; profiles_b: unknown }>) {
      const other =
        row.user_a === userId
          ? (row.profiles_b as unknown as ProfileRow)
          : (row.profiles_a as unknown as ProfileRow);
      const isIncoming = row.requested_by !== userId;
      if (!other) continue;
      const user: ConnectionUser = toConnectionUser(other);
      if (isIncoming) incoming.push({ id: row.id, user, direction: 'incoming', createdAt: row.created_at });
      else outgoing.push({ id: row.id, user, createdAt: row.created_at });
    }
    return { incoming, outgoing };
  }
  return { incoming: [], outgoing: [] };
}

export async function searchBondId(userId: string, query: string): Promise<ConnectionUser[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, bond_id, avatar_style, avatar_color, bio')
      .or(`bond_id.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(20);
    if (error || !data) return [];
    const { data: conns } = await supabase.from('connections').select('user_a, user_b').or(`user_a.eq.${userId},user_b.eq.${userId}`);
    const known = new Set<string>();
    for (const c of conns ?? []) {
      known.add(c.user_a as string);
      known.add(c.user_b as string);
    }
    known.add(userId);
    return data
      .filter((p) => !known.has(p.id as string))
      .map((p) => ({
        id: p.id as string,
        displayName: (p as unknown as ProfileRow).display_name,
        bondId: (p as unknown as ProfileRow).bond_id,
        avatarStyle: (p as unknown as ProfileRow).avatar_style ?? 0,
        avatarColor: (p as unknown as ProfileRow).avatar_color ?? 0,
        bio: (p as unknown as ProfileRow).bio ?? undefined,
      }));
  }
  return [];
}

export async function sendRequest(userId: string, otherId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const [a, b] = userId < otherId ? [userId, otherId] : [otherId, userId];
    const { error } = await supabase.from('connections').insert({
      user_a: a,
      user_b: b,
      requested_by: userId,
      invited_by: userId,
      status: 'pending',
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  return { ok: false, error: 'Backend not configured' };
}

export async function respondRequest(
  _userId: string,
  connectionId: string,
  action: 'accept' | 'decline'
): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    if (action === 'accept') {
      const { error } = await supabase.from('connections').update({ status: 'accepted', requested_by: _userId }).eq('id', connectionId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from('connections').delete().eq('id', connectionId);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  }
  return { ok: false, error: 'Backend not configured' };
}

export async function removeConnection(_userId: string, connectionId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('connections').delete().eq('id', connectionId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  return { ok: false, error: 'Backend not configured' };
}