import { supabase, isBackendConfigured } from './supabase';

export type SurpriseType = 'message' | 'media';

export interface SurpriseBox {
  id: string;
  type: SurpriseType;
  content: string;
  revealAt: string;
  opened: boolean;
  openedAt?: string;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
    bondId: string;
    avatarStyle: number;
    avatarColor: number;
  };
  recipient: {
    id: string;
    displayName: string;
    bondId: string;
    avatarStyle: number;
    avatarColor: number;
  };
  /** True if the current user is the recipient (i.e. can open). */
  mine: boolean;
}

interface ProfileEmbed {
  id: string;
  display_name: string;
  bond_id: string;
  avatar_style: number | null;
  avatar_color: number | null;
}

interface SurpriseBoxRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  type: SurpriseType;
  content: string;
  reveal_at: string;
  opened: boolean;
  opened_at: string | null;
  created_at: string;
  sender: ProfileEmbed | null;
  recipient: ProfileEmbed | null;
}

function toProfile(p: ProfileEmbed): { id: string; displayName: string; bondId: string; avatarStyle: number; avatarColor: number } {
  return {
    id: p.id,
    displayName: p.display_name,
    bondId: p.bond_id,
    avatarStyle: p.avatar_style ?? 0,
    avatarColor: p.avatar_color ?? 0,
  };
}

export async function listSurpriseBoxes(userId: string): Promise<SurpriseBox[]> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { data, error } = await client
      .from('surprise_boxes')
      .select(
        'id, sender_id, recipient_id, type, content, reveal_at, opened, opened_at, created_at, ' +
          'sender:sender_id(id, display_name, bond_id, avatar_style, avatar_color), ' +
          'recipient:recipient_id(id, display_name, bond_id, avatar_style, avatar_color)'
      )
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('reveal_at', { ascending: true });
    if (error || !data) return [];
    const items: SurpriseBox[] = [];
    for (const row of data as unknown as SurpriseBoxRow[]) {
      if (!row.sender || !row.recipient) continue;
      items.push({
        id: row.id,
        type: row.type,
        content: row.content,
        revealAt: row.reveal_at,
        opened: row.opened,
        openedAt: row.opened_at ?? undefined,
        createdAt: row.created_at,
        sender: toProfile(row.sender),
        recipient: toProfile(row.recipient),
        mine: row.recipient_id === userId,
      });
    }
    return items;
  }
  return [];
}

/**
 * Schedule a future message (a "surprise box") for a trusted connection.
 */
export async function createSurprise(
  senderId: string,
  recipientId: string,
  content: string,
  revealAt: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: 'Write a message to reveal' };
  if (!recipientId) return { ok: false, error: 'Choose who it is for' };
  if (!revealAt || new Date(revealAt).getTime() <= Date.now()) {
    return { ok: false, error: 'Pick a time in the future' };
  }

  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { error } = await client
      .from('surprise_boxes')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        type: 'message',
        content: trimmed,
        reveal_at: revealAt,
      });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  return { ok: false, error: 'Backend not configured' };
}

/**
 * Open a surprise box (recipient) once it has been revealed.
 */
export async function openSurprise(
  boxId: string,
  userId: string
): Promise<{ ok: boolean; content?: string; error?: string }> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { data: box, error: getErr } = await client
      .from('surprise_boxes')
      .select('id, recipient_id, content, reveal_at')
      .eq('id', boxId)
      .eq('recipient_id', userId)
      .single();
    const b = box as { id: string; recipient_id: string; content: string; reveal_at: string } | null;
    if (getErr || !b) return { ok: false, error: 'Surprise not found' };
    if (new Date(b.reveal_at).getTime() > Date.now()) {
      return { ok: false, error: 'This surprise is not ready yet' };
    }
    const { error: uErr } = await client
      .from('surprise_boxes')
      .update({ opened: true, opened_at: new Date().toISOString() })
      .eq('id', boxId);
    if (uErr) return { ok: false, error: uErr.message };
    return { ok: true, content: b.content };
  }

  return { ok: false, error: 'Backend not configured' };
}

/**
 * Delete a surprise box the current user created (before it is revealed).
 */
export async function deleteSurprise(
  boxId: string,
  senderId: string
): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const { error } = await client.from('surprise_boxes').delete().eq('id', boxId).eq('sender_id', senderId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  return { ok: false, error: 'Backend not configured' };
}
