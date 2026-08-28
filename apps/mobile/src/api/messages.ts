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
/* Preview-mode demo data                                             */
/* ================================================================== */

const PREVIEW_USERS: ChatParticipant[] = [
  { id: 'p-alice', displayName: 'Alice', bondId: 'alice', avatarStyle: 0, avatarColor: 0 },
  { id: 'p-ben', displayName: 'Ben', bondId: 'ben', avatarStyle: 3, avatarColor: 2 },
  { id: 'p-maya', displayName: 'Maya', bondId: 'maya', avatarStyle: 5, avatarColor: 1 },
  { id: 'p-rosa', displayName: 'Rosa', bondId: 'rosa', avatarStyle: 1, avatarColor: 3 },
];

interface PreviewMessage extends ChatMessage {}

interface PreviewConvo {
  otherId: string;
  messages: PreviewMessage[];
}

let previewConversations: PreviewConvo[] = [
  {
    otherId: 'p-alice',
    messages: [
      { id: 'pm-1', conversationId: 'pc-alice', senderId: 'p-alice', type: 'text', content: 'Hey! Are we still on for Friday?', status: 'read', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
      { id: 'pm-2', conversationId: 'pc-alice', senderId: 'you', type: 'text', content: 'Yes! 7pm at the usual place 🎉', status: 'read', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString() },
      { id: 'pm-3', conversationId: 'pc-alice', senderId: 'p-alice', type: 'text', content: 'Perfect, see you there.', status: 'delivered', createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
    ],
  },
  {
    otherId: 'p-ben',
    messages: [
      { id: 'pm-4', conversationId: 'pc-ben', senderId: 'p-ben', type: 'text', content: 'Got the photos from the trip 😍', status: 'read', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    ],
  },
];

const previewMessageId = (() => {
  let n = 100;
  return () => `pm-${n++}`;
})();

function previewConvoFor(otherId: string): PreviewConvo | undefined {
  return previewConversations.find((c) => c.otherId === otherId);
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
    if (error || !mine) return previewConversationsList(userId);
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
  return previewConversationsList(userId);
}

function summarize(m: MessageRow): string {
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'video') return '🎬 Video';
  if (m.type === 'voice') return '🎙️ Voice message';
  if (m.type === 'document') return '📄 Document';
  return m.content;
}

function previewConversationsList(userId: string): ConversationSummary[] {
  const summaries = previewConversations.map((c) => {
    const other = PREVIEW_USERS.find((u) => u.id === c.otherId);
    if (!other) return null;
    const last = c.messages[c.messages.length - 1];
    return {
      id: c.messages[0].conversationId,
      other,
      lastMessage: last.type === 'image' ? '📷 Photo' : last.content,
      lastMessageAt: last.createdAt,
      lastMessageType: last.type,
      unread: last.senderId !== 'you',
    } as ConversationSummary;
  });
  return summaries
    .filter((s): s is ConversationSummary => Boolean(s))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

/**
 * Find (or create) the direct conversation between two users.
 */
export async function getOrCreateConversation(userId: string, otherId: string): Promise<{ id: string } | { error: string }> {
  if (isBackendConfigured && supabase) {
    // Find an existing direct conversation where both are members.
    const { data: mine } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', userId);
    const { data: theirs } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', otherId);
    const shared = mine?.map((m) => m.conversation_id).filter((id) => theirs?.some((t) => t.conversation_id === id)) ?? [];
    if (shared.length > 0) return { id: shared[0] };

    // Create a new direct conversation + both member rows.
    const { data, error } = await supabase
      .from('conversations')
      .insert({ is_group: false, created_by: userId })
      .select('id')
      .single();
    if (error || !data) return { error: error?.message ?? 'Failed to create conversation' };
    const id = data.id;
    const { error: e1 } = await supabase.from('conversation_members').insert({ conversation_id: id, user_id: userId });
    const { error: e2 } = await supabase.from('conversation_members').insert({ conversation_id: id, user_id: otherId });
    if (e1 || e2) return { error: e1?.message ?? e2?.message ?? 'Failed to add members' };
    return { id };
  }
  return { id: previewConvoFor(otherId)?.messages[0].conversationId ?? `pc-${otherId}` };
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
  return previewConversations.find((c) => c.messages[0]?.conversationId === conversationId)?.messages ?? [];
}

function pushPreviewMessage(otherId: string, msg: PreviewMessage) {
  const convo = previewConvoFor(otherId);
  const id = convo?.messages[0]?.conversationId ?? `pc-${otherId}`;
  const m: PreviewMessage = { ...msg, id: msg.id ?? previewMessageId(), conversationId: id };
  if (convo) {
    convo.messages.push(m);
  } else {
    previewConversations.push({ otherId, messages: [m] });
  }
  return m;
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

  const convo = previewConversations.find((c) => c.messages[0]?.conversationId === conversationId);
  const otherId = convo?.otherId ?? conversationId.replace('pc-', '');
  const m = pushPreviewMessage(otherId, {
    id: '',
    conversationId,
    senderId,
    type: 'text',
    content: trimmed,
    status: 'sent',
    createdAt: new Date().toISOString(),
  });
  return { ok: true, message: m };
}

/**
 * Send a photo message.
 *
 * NOTE: Real photo upload requires `expo-image-picker` + Supabase Storage
 * (migration 0003 already provisions the `bond-media` bucket + RLS). That native
 * dependency isn't installed in this prototype, so in preview mode we send an
 * inline "photo" message with the provided URI (or a placeholder). The upload
 * path is documented for Phase 6.
 */
export async function sendPhotoMessage(
  conversationId: string,
  senderId: string,
  uri?: string
): Promise<{ ok: boolean; message?: ChatMessage; error?: string }> {
  const mediaMetadata: MediaMetadata = { uri: uri ?? 'bond://preview-photo-placeholder', mimeType: 'image/jpeg' };

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

  const convo = previewConversations.find((c) => c.messages[0]?.conversationId === conversationId);
  const otherId = convo?.otherId ?? conversationId.replace('pc-', '');
  const m = pushPreviewMessage(otherId, {
    id: '',
    conversationId,
    senderId,
    type: 'image',
    content: '',
    mediaMetadata,
    status: 'sent',
    createdAt: new Date().toISOString(),
  });
  return { ok: true, message: m };
}

/**
 * Real-time subscription for new messages in a conversation (Supabase only).
 * Returns an unsubscribe function. In preview mode we no-op.
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
