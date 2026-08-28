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
/* Preview-mode demo data                                             */
/* ================================================================== */
const PREVIEW_USERS: ConnectionUser[] = [
  { id: 'p-alice', displayName: 'Alice', bondId: 'alice', avatarStyle: 0, avatarColor: 0, bio: 'Hello from Bond' },
  { id: 'p-ben', displayName: 'Ben', bondId: 'ben', avatarStyle: 3, avatarColor: 2, bio: 'Stay close' },
  { id: 'p-maya', displayName: 'Maya', bondId: 'maya', avatarStyle: 5, avatarColor: 1, bio: 'Coffee first' },
  { id: 'p-rosa', displayName: 'Rosa', bondId: 'rosa', avatarStyle: 1, avatarColor: 3, bio: 'Family ♥' },
  { id: 'p-jordan', displayName: 'Jordan', bondId: 'jordan', avatarStyle: 2, avatarColor: 4, bio: 'New here ✨' },
  { id: 'p-kai', displayName: 'Kai', bondId: 'kai', avatarStyle: 6, avatarColor: 6, bio: 'Music, food, travel' },
];

let previewState = {
  connectedIds: new Set(['p-alice', 'p-ben']),
  incomingIds: ['p-maya'] as string[],
  outgoingIds: ['p-rosa'] as string[],
};

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
    if (error || !data) return previewConnections();
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
  return previewConnections();
}

function previewConnections(): ConnectionUser[] {
  return PREVIEW_USERS.filter((u) => previewState.connectedIds.has(u.id));
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
    if (error || !data) return previewRequests();
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
  return previewRequests();
}

function previewRequests(): { incoming: ConnectionRequest[]; outgoing: OutgoingRequest[] } {
  const incoming = previewState.incomingIds
    .map((id): ConnectionRequest | null => {
      const u = PREVIEW_USERS.find((x) => x.id === id);
      return u ? { id: `req-${id}`, user: u, direction: 'incoming', createdAt: new Date().toISOString() } : null;
    })
    .filter((x): x is ConnectionRequest => Boolean(x));
  const outgoing = previewState.outgoingIds
    .map((id): OutgoingRequest | null => {
      const u = PREVIEW_USERS.find((x) => x.id === id);
      return u ? { id: `req-${id}`, user: u, createdAt: new Date().toISOString() } : null;
    })
    .filter((x): x is OutgoingRequest => Boolean(x));
  return { incoming, outgoing };
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
    if (error || !data) return previewSearch(query);
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
  return previewSearch(query);
}

function previewSearch(query: string): ConnectionUser[] {
  return PREVIEW_USERS.filter(
    (u) =>
      (u.bondId.includes(query) || u.displayName.toLowerCase().includes(query)) &&
      !previewState.connectedIds.has(u.id) &&
      !previewState.incomingIds.includes(u.id) &&
      !previewState.outgoingIds.includes(u.id)
  );
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
  const u = PREVIEW_USERS.find((x) => x.id === otherId);
  if (u) previewState.outgoingIds.push(otherId);
  return { ok: true };
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
  if (action === 'accept') {
    const u = PREVIEW_USERS.find((x) => previewState.incomingIds.includes(x.id));
    if (u) {
      previewState.incomingIds = previewState.incomingIds.filter((id) => id !== u.id);
      previewState.connectedIds.add(u.id);
    }
  } else {
    previewState.incomingIds = previewState.incomingIds.filter((id) => id !== connectionId.replace('req-', ''));
  }
  return { ok: true };
}

export async function removeConnection(_userId: string, connectionId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('connections').delete().eq('id', connectionId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  previewState.connectedIds = new Set([...previewState.connectedIds].filter((id) => id !== connectionId));
  return { ok: true };
}