import { supabase, isBackendConfigured } from '../supabase';

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

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */

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
    if (error || !data) return [];
    const list: VoiceDiaryEntry[] = [];
    for (const row of data as unknown as VoiceDiaryRow[]) {
      const entry = toEntry(row, (row as unknown as { author: AuthorEmbed | null }).author ?? null, userId);
      if (!entry.mine && isExpired(entry)) continue;
      list.push(entry);
    }
    return list;
  }
  return [];
}

export async function createVoiceDiary(
  userId: string,
  opts: { voiceUri: string; transcript?: string; audience: VoiceAudience; spaceId?: string; expiresAt?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!opts.voiceUri) return { ok: false, error: 'No voice note recorded' };

  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('voice_diaries').insert({
      user_id: userId,
      audience: opts.audience,
      space_id: opts.spaceId ?? null,
      voice_uri: opts.voiceUri,
      transcript: opts.transcript?.trim() ? opts.transcript.trim() : null,
      expires_at: opts.expiresAt ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  return { ok: false, error: 'Backend not configured' };
}

export async function deleteVoiceDiary(userId: string, entryId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('voice_diaries').delete().eq('id', entryId).eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  return { ok: false, error: 'Backend not configured' };
}