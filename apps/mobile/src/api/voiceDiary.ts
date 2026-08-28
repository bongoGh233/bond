import { supabase, isBackendConfigured } from './supabase';
import { uploadBondMedia } from './media';

export type VoiceAudience = 'private' | 'connections' | 'space';

export interface VoiceDiaryEntry {
  id: string;
  userId: string;
  audience: VoiceAudience;
  spaceId?: string;
  voiceUri: string;
  transcript?: string;
  createdAt: string;
  expiresAt?: string;
  /** True when the author is the current user. */
  mine: boolean;
  authorName: string;
  authorAvatarStyle: number;
  authorAvatarColor: number;
}

interface VoiceDiaryRow {
  id: string;
  user_id: string;
  audience: VoiceAudience;
  space_id: string | null;
  voice_uri: string;
  transcript: string | null;
  created_at: string;
  expires_at: string | null;
}

interface AuthorEmbed {
  id: string;
  display_name: string;
  avatar_style: number | null;
  avatar_color: number | null;
}

function toEntry(r: VoiceDiaryRow, author: AuthorEmbed | null, myId: string): VoiceDiaryEntry {
  return {
    id: r.id,
    userId: r.user_id,
    audience: r.audience,
    spaceId: r.space_id ?? undefined,
    voiceUri: r.voice_uri,
    transcript: r.transcript ?? undefined,
    createdAt: r.created_at,
    expiresAt: r.expires_at ?? undefined,
    mine: r.user_id === myId,
    authorName: author?.display_name ?? 'Someone',
    authorAvatarStyle: author?.avatar_style ?? 0,
    authorAvatarColor: author?.avatar_color ?? 0,
  };
}

function isExpired(e: VoiceDiaryEntry): boolean {
  if (!e.expiresAt) return false;
  return new Date(e.expiresAt).getTime() < Date.now();
}

function mimeForAudio(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return 'audio/mp4';
}

/* ================================================================== */
/* Preview-mode demo data                                             */
/* ================================================================== */

let previewDiary: VoiceDiaryEntry[] = [
  {
    id: 'vd-1',
    userId: 'you',
    audience: 'private',
    voiceUri: 'bond://preview-voice-1',
    transcript: 'Morning thoughts. I should call Dad today.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    mine: true,
    authorName: 'You',
    authorAvatarStyle: 0,
    authorAvatarColor: 0,
  },
  {
    id: 'vd-2',
    userId: 'p-alice',
    audience: 'connections',
    voiceUri: 'bond://preview-voice-2',
    transcript: 'This song makes me think of the beach trip. Recording it here so you hear it too.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    mine: false,
    authorName: 'Alice',
    authorAvatarStyle: 0,
    authorAvatarColor: 0,
  },
  {
    id: 'vd-3',
    userId: 'p-ben',
    audience: 'connections',
    voiceUri: 'bond://preview-voice-3',
    transcript: 'Quick update — the hike was incredible. Listen when you can.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    mine: false,
    authorName: 'Ben',
    authorAvatarStyle: 3,
    authorAvatarColor: 2,
  },
];

const previewDiarySeq = (() => {
  let n = 10;
  return () => `vd-${n++}`;
})();

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */

/**
 * List voice diary entries the current user can see (their own, plus entries
 * shared to connections or to spaces they belong to). In preview mode we simply
 * return the demo list.
 */
export async function listVoiceDiaries(userId: string): Promise<VoiceDiaryEntry[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('voice_diaries')
      .select(
        'id, user_id, audience, space_id, voice_uri, transcript, created_at, expires_at, ' +
          'author:profiles!voice_diaries_user_id_fkey(id, display_name, avatar_style, avatar_color)'
      )
      .order('created_at', { ascending: false })
      .limit(100);
    if (error || !data) return previewDiary.slice().filter((e) => !isExpired(e));
    const list: VoiceDiaryEntry[] = [];
    for (const row of data as unknown as VoiceDiaryRow[]) {
      const entry = toEntry(row, (row as unknown as { author: AuthorEmbed | null }).author ?? null, userId);
      if (!entry.mine && isExpired(entry)) continue;
      list.push(entry);
    }
    return list;
  }
  return previewDiary.slice().filter((e) => !isExpired(e));
}

/**
 * Create a voice diary entry.
 *
 * When the backend is live the local recording is uploaded into the private
 * `bond-media` bucket (owner folder) and the registry row is linked to the
 * diary so storage read authorization (message/moment/voice-diary rules) can
 * gate access for connections. `voice_uri` stores the storage object path in
 * that case; local URI is kept when upload fails or in preview mode.
 */
export async function createVoiceDiary(
  userId: string,
  opts: { voiceUri: string; transcript?: string; audience: VoiceAudience; spaceId?: string; expiresAt?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!opts.voiceUri) return { ok: false, error: 'No voice note recorded' };

  if (isBackendConfigured && supabase) {
    const { data: created, error } = await supabase
      .from('voice_diaries')
      .insert({
        user_id: userId,
        audience: opts.audience,
        space_id: opts.spaceId ?? null,
        voice_uri: opts.voiceUri,
        transcript: opts.transcript?.trim() ? opts.transcript.trim() : null,
        expires_at: opts.expiresAt ?? null,
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    if (!created) return { ok: true };

    // Upload the local recording and re-point the registry to the object.
    const uploaded = await uploadBondMedia(userId, opts.voiceUri, mimeForAudio(opts.voiceUri));
    if (uploaded.objectName) {
      await supabase
        .from('voice_diaries')
        .update({ voice_uri: uploaded.objectName })
        .eq('id', (created as { id: string }).id);
      await supabase.from('media').upsert(
        {
          owner_id: userId,
          bucket_id: 'bond-media',
          object_name: uploaded.objectName,
          voice_diary_id: (created as { id: string }).id,
          mime_type: mimeForAudio(opts.voiceUri),
        },
        { onConflict: 'object_name' }
      );
    }
    return { ok: true };
  }

  previewDiary.unshift({
    id: previewDiarySeq(),
    userId,
    audience: opts.audience,
    spaceId: opts.spaceId,
    voiceUri: opts.voiceUri,
    transcript: opts.transcript?.trim() || undefined,
    createdAt: new Date().toISOString(),
    expiresAt: opts.expiresAt,
    mine: true,
    authorName: 'You',
    authorAvatarStyle: 0,
    authorAvatarColor: 0,
  });
  return { ok: true };
}

/**
 * Delete one of the current user's entries.
 */
export async function deleteVoiceDiary(userId: string, entryId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('voice_diaries').delete().eq('id', entryId).eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  previewDiary = previewDiary.filter((e) => !(e.id === entryId && e.mine));
  return { ok: true };
}