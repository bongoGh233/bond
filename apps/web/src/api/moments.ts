import { supabase, isBackendConfigured } from '../supabase';
import type { MediaMetadata } from './messages';
import { uploadBondMedia } from './media';

export type MomentType = 'text' | 'image' | 'video' | 'voice';
export type MomentDuration = 'short' | 'hour' | 'day' | 'permanent';

export interface Moment {
  id: string;
  userId: string;
  author: { displayName: string; avatarStyle: number; avatarColor: number } | null;
  type: MomentType;
  caption: string;
  mediaMetadata?: MediaMetadata | null;
  duration: MomentDuration;
  expiresAt: string | null;
  createdAt: string;
  viewCount: number;
  viewerIds: string[];
  mine: boolean;
}

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_style: number | null;
  avatar_color: number | null;
}

const DURATION_MS: Record<MomentDuration, number | null> = {
  short: 12 * 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  permanent: null,
};

interface MomentRow {
  id: string;
  user_id: string;
  type: MomentType;
  caption: string;
  media_metadata: MediaMetadata | null;
  duration: MomentDuration;
  expires_at: string | null;
  created_at: string;
}

function toMoment(row: MomentRow, author: ProfileRow | null, viewerIds: string[], myId: string): Moment {
  return {
    id: row.id,
    userId: row.user_id,
    author: author
      ? { displayName: author.display_name, avatarStyle: author.avatar_style ?? 0, avatarColor: author.avatar_color ?? 0 }
      : null,
    type: row.type,
    caption: row.caption,
    mediaMetadata: row.media_metadata ?? null,
    duration: row.duration,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    viewCount: viewerIds.length,
    viewerIds,
    mine: row.user_id === myId,
  };
}

function isExpired(m: Moment): boolean {
  if (!m.expiresAt) return false;
  return new Date(m.expiresAt).getTime() < Date.now();
}

/* ================================================================== */
/* Preview-mode demo data                                             */
/* ================================================================== */

interface PreviewAuthor {
  displayName: string;
  avatarStyle: number;
  avatarColor: number;
}

interface PreviewMoment {
  id: string;
  author: PreviewAuthor;
  mine: boolean;
  type: MomentType;
  caption: string;
  mediaMetadata?: MediaMetadata | null;
  duration: MomentDuration;
  createdAt: string;
  viewerIds: string[];
}

const now = Date.now();
let previewMoments: PreviewMoment[] = [
  {
    id: 'pmom-1',
    author: { displayName: 'Alice', avatarStyle: 0, avatarColor: 0 },
    mine: false,
    type: 'text',
    caption: 'Golden hour walk 🌇',
    duration: 'day',
    createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
    viewerIds: ['you', 'p-ben'],
  },
  {
    id: 'pmom-2',
    author: { displayName: 'Ben', avatarStyle: 3, avatarColor: 2 },
    mine: false,
    type: 'image',
    caption: 'Sunset from the hike 🔥',
    mediaMetadata: { uri: '', mimeType: 'image/jpeg' },
    duration: 'hour',
    createdAt: new Date(now - 1000 * 60 * 30).toISOString(),
    viewerIds: ['you'],
  },
  {
    id: 'pmom-3',
    author: { displayName: 'Maya', avatarStyle: 5, avatarColor: 1 },
    mine: false,
    type: 'text',
    caption: 'Coffee first, then everything ☕',
    duration: 'short',
    createdAt: new Date(now - 1000 * 60 * 10).toISOString(),
    viewerIds: [],
  },
];

let previewMomentSeq = 100;
const nextPreviewMomentId = () => `pmom-${previewMomentSeq++}`;

function toPreviewMoment(p: PreviewMoment): Moment {
  const expiresAt = p.duration === 'permanent' ? null : new Date(new Date(p.createdAt).getTime() + (DURATION_MS[p.duration] ?? 0)).toISOString();
  return {
    id: p.id,
    userId: p.mine ? 'you' : p.author.displayName,
    author: p.author,
    type: p.type,
    caption: p.caption,
    mediaMetadata: p.mediaMetadata ?? null,
    duration: p.duration,
    expiresAt,
    createdAt: p.createdAt,
    viewCount: p.viewerIds.length,
    viewerIds: p.viewerIds,
    mine: p.mine,
  };
}

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */

export async function listFeedMoments(myId: string): Promise<Moment[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('moments')
      .select('id, user_id, type, caption, media_metadata, duration, expires_at, created_at, author:profiles!moments_user_id_fkey(id, display_name, avatar_style, avatar_color), views:moment_views(viewer_id)')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error || !data) return previewFeedMoments();
    const list: Moment[] = [];
    for (const row of data as unknown as MomentRow[]) {
      const m = toMoment(
        row,
        (row as unknown as { author: ProfileRow | null }).author ?? null,
        ((row as unknown as { views?: { viewer_id: string }[] }).views ?? []).map((v) => v.viewer_id),
        myId
      );
      if (!m.mine && isExpired(m)) continue;
      list.push(m);
    }
    return list;
  }
  return previewFeedMoments();
}

function previewFeedMoments(): Moment[] {
  return previewMoments
    .map(toPreviewMoment)
    .filter((m) => !isExpired(m))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createTextMoment(
  userId: string,
  caption: string,
  duration: MomentDuration
): Promise<{ ok: boolean; error?: string }> {
  const text = caption.trim();
  if (!text) return { ok: false, error: 'Add a caption first' };
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('moments').insert({
      user_id: userId,
      type: 'text',
      caption: text,
      duration,
      expires_at: duration === 'permanent' ? null : new Date(Date.now() + (DURATION_MS[duration] ?? 0)).toISOString(),
      visibility: { mode: 'connections', user_ids: [] },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  previewMoments.unshift({
    id: nextPreviewMomentId(),
    author: { displayName: 'You', avatarStyle: 0, avatarColor: 0 },
    mine: true,
    type: 'text',
    caption: text,
    duration,
    createdAt: new Date().toISOString(),
    viewerIds: [],
  });
  return { ok: true };
}

export async function createPhotoMoment(
  userId: string,
  uri: string,
  caption: string,
  duration: MomentDuration
): Promise<{ ok: boolean; error?: string }> {
  const text = caption.trim();
  if (!uri && !text) return { ok: false, error: 'Add an image or a caption' };
  if (isBackendConfigured && supabase) {
    const uploaded = await uploadBondMedia(userId, uri, 'image/jpeg');
    const { data, error } = await supabase
      .from('moments')
      .insert({
        user_id: userId,
        type: 'image',
        caption: text,
        media_metadata: { uri: uploaded.uri, mimeType: 'image/jpeg', objectName: uploaded.objectName || undefined },
        duration,
        expires_at: duration === 'permanent' ? null : new Date(Date.now() + (DURATION_MS[duration] ?? 0)).toISOString(),
        visibility: { mode: 'connections', user_ids: [] },
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    if (uploaded.objectName) {
      try {
        const mom = data as { id: string };
        await supabase.from('media').upsert(
          { owner_id: userId, bucket_id: 'bond-media', object_name: uploaded.objectName, moment_id: mom.id, mime_type: 'image/jpeg' },
          { onConflict: 'object_name' }
        );
      } catch {
        // Registration is best-effort.
      }
    }
    return { ok: true };
  }
  previewMoments.unshift({
    id: nextPreviewMomentId(),
    author: { displayName: 'You', avatarStyle: 0, avatarColor: 0 },
    mine: true,
    type: 'image',
    caption: text,
    mediaMetadata: { uri, mimeType: 'image/jpeg' },
    duration,
    createdAt: new Date().toISOString(),
    viewerIds: [],
  });
  return { ok: true };
}

export async function viewMoment(myId: string, momentId: string): Promise<void> {
  if (isBackendConfigured && supabase) {
    await supabase.from('moment_views').upsert({ moment_id: momentId, viewer_id: myId }, { onConflict: 'moment_id,viewer_id', ignoreDuplicates: true });
    return;
  }
  const p = previewMoments.find((x) => x.id === momentId);
  if (p && !p.viewerIds.includes('you')) p.viewerIds.push('you');
}

export async function deleteMoment(userId: string, momentId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('moments').delete().eq('id', momentId).eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  previewMoments = previewMoments.filter((m) => m.id !== momentId);
  return { ok: true };
}