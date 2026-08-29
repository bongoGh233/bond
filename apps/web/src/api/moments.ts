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
/* API                                                                 */
/* ================================================================== */

export async function listFeedMoments(myId: string): Promise<Moment[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('moments')
      .select('id, user_id, type, caption, media_metadata, duration, expires_at, created_at, author:profiles!moments_user_id_fkey(id, display_name, avatar_style, avatar_color), views:moment_views(viewer_id)')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error || !data) return [];
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
  return [];
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
  return { ok: false, error: 'Backend not configured' };
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
  return { ok: false, error: 'Backend not configured' };
}

export async function viewMoment(myId: string, momentId: string): Promise<void> {
  if (isBackendConfigured && supabase) {
    await supabase.from('moment_views').upsert({ moment_id: momentId, viewer_id: myId }, { onConflict: 'moment_id,viewer_id', ignoreDuplicates: true });
  }
}

export async function deleteMoment(userId: string, momentId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('moments').delete().eq('id', momentId).eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  return { ok: false, error: 'Backend not configured' };
}