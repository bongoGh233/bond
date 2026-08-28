import { supabase, isBackendConfigured } from '../supabase';
import type { MediaMetadata } from './messages';

export interface SharedMember {
  id: string;
  displayName: string;
  avatarStyle: number;
  avatarColor: number;
}

export interface SharedSpace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  members: SharedMember[];
  memberCount: number;
}

export interface Memory {
  id: string;
  spaceId: string;
  addedBy: string;
  author: SharedMember | null;
  note: string;
  milestone: boolean;
  mediaMetadata?: MediaMetadata | null;
  createdAt: string;
}

export interface BucketItem {
  id: string;
  spaceId: string;
  userId: string;
  title: string;
  note: string;
  done: boolean;
  doneBy: string | null;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_style: number | null;
  avatar_color: number | null;
}

function toMember(p: ProfileRow): SharedMember {
  return {
    id: p.id,
    displayName: p.display_name,
    avatarStyle: p.avatar_style ?? 0,
    avatarColor: p.avatar_color ?? 0,
  };
}

/* ================================================================== */
/* Preview-mode demo data                                             */
/* ================================================================== */

const PREVIEW_SPACE: SharedSpace = {
  id: 'pspace-1',
  name: 'The Getaway',
  createdBy: 'you',
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
  members: [
    { id: 'p-alice', displayName: 'Alice', avatarStyle: 0, avatarColor: 0 },
    { id: 'p-rosa', displayName: 'Rosa', avatarStyle: 1, avatarColor: 3 },
    { id: 'you', displayName: 'You', avatarStyle: 0, avatarColor: 0 },
  ],
  memberCount: 3,
};

interface PreviewMemory {
  id: string;
  author: SharedMember;
  note: string;
  milestone: boolean;
  createdAt: string;
}

let previewMemories: PreviewMemory[] = [
  { id: 'pmem-1', author: PREVIEW_SPACE.members[0], note: 'First night at the cabin 🏡', milestone: true, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString() },
  { id: 'pmem-2', author: PREVIEW_SPACE.members[1], note: 'Watched the sunrise from the deck', milestone: false, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString() },
  { id: 'pmem-3', author: PREVIEW_SPACE.members[0], note: 'Second trip — beach house 🏖️', milestone: true, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() },
];

interface PreviewBucket {
  id: string;
  userId: string;
  author: SharedMember;
  title: string;
  note: string;
  done: boolean;
  doneBy: string | null;
  createdAt: string;
}

let previewBucket: PreviewBucket[] = [
  { id: 'pb-1', userId: 'p-alice', author: PREVIEW_SPACE.members[0], title: 'Road trip along the coast', note: '', done: false, doneBy: null, createdAt: new Date().toISOString() },
  { id: 'pb-2', userId: 'you', author: PREVIEW_SPACE.members[2], title: 'Cook a full paella', note: 'Sunday vibes', done: false, doneBy: null, createdAt: new Date().toISOString() },
  { id: 'pb-3', userId: 'p-rosa', author: PREVIEW_SPACE.members[1], title: 'Camp under the stars', note: '', done: true, doneBy: 'you', createdAt: new Date().toISOString() },
];

const seq = (() => { let n = 100; return () => n++; })();

function mapPreviewBucket(b: PreviewBucket): BucketItem {
  return { id: b.id, spaceId: 'pspace-1', userId: b.userId, title: b.title, note: b.note, done: b.done, doneBy: b.doneBy, createdAt: b.createdAt };
}

/* ================================================================== */
/* API — spaces                                                        */
/* ================================================================== */

export async function listSpaces(_userId: string): Promise<SharedSpace[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('shared_spaces')
      .select('id, name, created_by, created_at, members:shared_space_members(profile:profiles!shared_space_members_user_id_fkey(id, display_name, avatar_style, avatar_color))')
      .order('created_at', { ascending: false });
    if (error || !data) return [PREVIEW_SPACE];
    const spaces: SharedSpace[] = [];
    for (const s of data as unknown as Array<{ id: string; name: string; created_by: string; created_at: string; members?: unknown }>) {
      const members = ((s.members ?? []) as Array<{ profile: unknown }>).map((m) => toMember(m.profile as unknown as ProfileRow)).filter(Boolean);
      spaces.push({ id: s.id, name: s.name, createdBy: s.created_by, createdAt: s.created_at, members, memberCount: members.length });
    }
    return spaces;
  }
  return [PREVIEW_SPACE];
}

export async function createSpace(userId: string, name: string, memberIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Name is required' };
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase.from('shared_spaces').insert({ name: trimmed, created_by: userId }).select('id').single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create space' };
    const id = data.id as string;
    const ids = Array.from(new Set([userId, ...memberIds]));
    await supabase.from('shared_space_members').insert(ids.map((uid) => ({ space_id: id, user_id: uid })));
    return { ok: true };
  }
  return { ok: true };
}

/* ================================================================== */
/* API — memories                                                      */
/* ================================================================== */

export async function listMemories(spaceId: string): Promise<Memory[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('memories')
      .select('id, space_id, added_by, note, milestone, media_metadata, created_at, author:profiles!memories_added_by_fkey(id, display_name, avatar_style, avatar_color)')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false });
    if (error || !data) return previewMemories.map((m) => ({ id: m.id, spaceId, addedBy: m.author.id, author: m.author, note: m.note, milestone: m.milestone, createdAt: m.createdAt }));
    const rows = data as unknown as Array<{ id: string; space_id: string; added_by: string; note: string; milestone: boolean; media_metadata: MediaMetadata | null; created_at: string; author: unknown }>;
    return rows.map((r) => {
      const author = r.author as unknown as ProfileRow | null;
      return {
        id: r.id,
        spaceId: r.space_id,
        addedBy: r.added_by,
        author: author ? toMember(author) : null,
        note: r.note,
        milestone: r.milestone,
        mediaMetadata: r.media_metadata ?? null,
        createdAt: r.created_at,
      };
    });
  }
  return previewMemories.map((m) => ({ id: m.id, spaceId, addedBy: m.author.id, author: m.author, note: m.note, milestone: m.milestone, createdAt: m.createdAt }));
}

export async function addMemory(spaceId: string, userId: string, note: string, milestone = false): Promise<{ ok: boolean; error?: string }> {
  const text = note.trim();
  if (!text) return { ok: false, error: 'Add a note first' };
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('memories').insert({ space_id: spaceId, added_by: userId, note: text, milestone });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const author = PREVIEW_SPACE.members.find((m) => m.id === 'you') ?? PREVIEW_SPACE.members[0];
  previewMemories.unshift({ id: `pmem-${seq()}`, author, note: text, milestone, createdAt: new Date().toISOString() });
  return { ok: true };
}

/* ================================================================== */
/* API — bucket list                                                   */
/* ================================================================== */

export async function listBucketItems(spaceId: string): Promise<BucketItem[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('bucket_list_items')
      .select('id, space_id, user_id, title, note, done, done_by, created_at')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true });
    if (error || !data) return previewBucket.map(mapPreviewBucket);
    return (data as unknown as Array<{ id: string; space_id: string; user_id: string; title: string; note: string; done: boolean; done_by: string | null; created_at: string }>).map((r) => ({
      id: r.id,
      spaceId: r.space_id,
      userId: r.user_id,
      title: r.title,
      note: r.note,
      done: r.done,
      doneBy: r.done_by,
      createdAt: r.created_at,
    }));
  }
  return previewBucket.map(mapPreviewBucket);
}

export async function addBucketItem(spaceId: string, userId: string, title: string, note = ''): Promise<{ ok: boolean; error?: string }> {
  const t = title.trim();
  if (!t) return { ok: false, error: 'Add a title first' };
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('bucket_list_items').insert({ space_id: spaceId, user_id: userId, title: t, note });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const author = PREVIEW_SPACE.members.find((m) => m.id === 'you') ?? PREVIEW_SPACE.members[0];
  previewBucket.unshift({ id: `pb-${seq()}`, userId: 'you', author, title: t, note, done: false, doneBy: null, createdAt: new Date().toISOString() });
  return { ok: true };
}

export async function toggleBucketItem(_spaceId: string, itemId: string, userId: string, done: boolean): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const { error } = await supabase
      .from('bucket_list_items')
      .update({ done, done_by: done ? userId : null, done_at: done ? new Date().toISOString() : null })
      .eq('id', itemId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const item = previewBucket.find((b) => b.id === itemId);
  if (item) {
    item.done = done;
    item.doneBy = done ? 'you' : null;
  }
  return { ok: true };
}