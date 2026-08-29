import { supabase, isBackendConfigured } from './supabase';
import { uploadBondMedia } from './media';

export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'document';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface MediaMetadata {
  uri?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  /** Storage object path in the bond-media bucket (set when uploaded live). */
  objectName?: string;
}

export interface ChatParticipant {
  id: string;
  displayName: string;
  bondId?: string;
  avatarStyle: number;
  avatarColor: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  mediaMetadata?: MediaMetadata | null;
  status: MessageStatus;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  other: ChatParticipant;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageType: MessageType;
  unread: boolean;
}

/* ================================================================== */
/* Types mapped from the Supabase rows                                */
/* ================================================================== */

interface ProfileRow {
  id: string;
  display_name: string;
  bond_id: string;
  avatar_style: number | null;
  avatar_color: number | null;
  bio: string | null;
}

function toParticipant(p: ProfileRow): ChatParticipant {
  return {
    id: p.id,
    displayName: p.display_name,
    bondId: p.bond_id,
    avatarStyle: p.avatar_style ?? 0,
    avatarColor: p.avatar_color ?? 0,
  };
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  content: string;
  media_metadata: MediaMetadata | null;
  status: MessageStatus;
  created_at: string;
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    type: row.type,
    content: row.content,
    mediaMetadata: row.media_metadata ?? null,
    status: row.status ?? 'sent',
    createdAt: row.created_at,
  };
}

/* ================================================================== */
/* API — conversations                                                 */
/* ================================================================== */

/**
 * List the current user's direct conversations, each with the other
 * participant and the latest message (drives the Chats tab).
 */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  if (isBackendConfigured && supabase) {
    // Conversations I belong to.
    const { data: mine, error } = await supabase
      .from('conversation_members')
      .select('conversation_id, conversation:conversations!inner(id, is_group, title)')
      .eq('user_id', userId);
    if (error || !mine) return [];
    const convoIds = mine.map((m) => m.conversation_id as string);

    // The other participant in each direct conversation.
    const { data: members } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id, profile:profiles!conversation_members_user_id_fkey(id, display_name, bond_id, avatar_style, avatar_color, bio)')
      .in('conversation_id', convoIds)
      .neq('user_id', userId);

    const byConvo = new Map<string, ChatParticipant>();
    for (const m of members ?? []) {
      if (!byConvo.has(m.conversation_id)) {
        const p = m.profile as unknown as ProfileRow;
        if (p) byConvo.set(m.conversation_id, toParticipant(p));
      }
    }

    // Latest message per conversation.
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, type, content, media_metadata, status, created_at')
      .in('conversation_id', convoIds)
      .order('created_at', { ascending: false });

    const lastByConvo = new Map<string, MessageRow>();
    for (const m of msgs ?? []) {
      if (!lastByConvo.has(m.conversation_id)) lastByConvo.set(m.conversation_id, m);
    }

    const summaries: ConversationSummary[] = [];
    for (const id of convoIds) {
      const other = byConvo.get(id);
      if (!other) continue;
      const last = lastByConvo.get(id);
      summaries.push({
        id,
        other,
        lastMessage: last ? summarize(last) : 'No messages yet',
        lastMessageAt: last ? last.created_at : new Date().toISOString(),
        lastMessageType: last ? last.type : 'text',
        unread: last ? last.sender_id !== userId : false,
      });
    }
    return summaries.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }
  return [];
}

function summarize(m: MessageRow): string {
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'video') return '🎬 Video';
  if (m.type === 'voice') return '🎙️ Voice message';
  if (m.type === 'document') return '📄 Document';
  return m.content;
}

/**
 * Find (or create) the direct conversation between two users.
 */
export async function getOrCreateConversation(userId: string, otherId: string): Promise<{ id: string } | { error: string }> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_user_id: userId,
      p_other_id: otherId,
    });
    if (error || !data) return { error: error?.message ?? 'Failed to create conversation' };
    return { id: data as string };
  }
  return { error: 'Backend not configured' };
}

/* ================================================================== */
/* API — messages                                                      */
/* ================================================================== */

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, type, content, media_metadata, status, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return (data as MessageRow[]).map(toMessage);
  }
  return [];
}

/**
 * Send a text message in a conversation.
 */
export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<{ ok: boolean; message?: ChatMessage; error?: string }> {
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: 'Message is empty' };

  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, type: 'text', content: trimmed, status: 'sent' })
      .select('id, conversation_id, sender_id, type, content, media_metadata, status, created_at')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: toMessage(data as MessageRow) };
  }

  return { ok: false, error: 'Backend not configured' };
}

/**
 * Send a photo message.
 *
 * Real photo upload requires `expo-image-picker` + Supabase Storage
 * (migration 0003 already provisions the `bond-media` bucket + RLS).
 */
export async function sendPhotoMessage(
  conversationId: string,
  senderId: string,
  uri?: string
): Promise<{ ok: boolean; message?: ChatMessage; error?: string }> {
  const mediaMetadata: MediaMetadata = { uri: uri ?? '', mimeType: 'image/jpeg' };

  if (isBackendConfigured && supabase) {
    if (!uri) return { ok: false, error: 'No photo selected' };
    // Upload the real file into the private bond-media bucket, then reference it
    // in the message. Falls back to the local URI if the upload itself fails.
    const uploaded = await uploadBondMedia(senderId, uri, 'image/jpeg');
    mediaMetadata.uri = uploaded.uri;
    mediaMetadata.objectName = uploaded.objectName || undefined;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        type: 'image',
        content: '',
        media_metadata: mediaMetadata,
        status: 'sent',
      })
      .select('id, conversation_id, sender_id, type, content, media_metadata, status, created_at')
      .single();
    if (error) return { ok: false, error: error.message };
    // Register the object against the message so media RLS can gate reads.
    if (uploaded.objectName) {
      try {
        const msg = data as { id: string };
        await supabase.from('media').upsert(
          { owner_id: senderId, bucket_id: 'bond-media', object_name: uploaded.objectName, message_id: msg.id, mime_type: 'image/jpeg' },
          { onConflict: 'object_name' }
        );
      } catch {
        // Registration is best-effort; the message still references the object.
      }
    }
    return { ok: true, message: toMessage(data as MessageRow) };
  }

  return { ok: false, error: 'Backend not configured' };
}

/**
 * Real-time subscription for new messages in a conversation (Supabase only).
 * Returns an unsubscribe function. When unconfigured we no-op.
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: ChatMessage) => void
): () => void {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const channel = client
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          if (row) onMessage(toMessage(row));
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }
  return () => {};
}

/**
 * Mark a conversation as read for the current user.
 */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  if (isBackendConfigured && supabase) {
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  }
}
