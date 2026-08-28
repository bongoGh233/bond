import { supabase, isBackendConfigured } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Contact {
  id: string;
  name: string;
  avatarColor: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  content: string;
  createdAt: string;
  mine: boolean;
  locked?: boolean;
  status?: string;
}

export interface Conversation {
  id: string;
  other: Contact;
  last?: string;
  lastAt?: string;
}

/* ----------------------------- Preview mode ----------------------------- */
const previewContacts: Contact[] = [
  { id: '00000000-0000-0000-0000-000000000002', name: 'Ben', avatarColor: 3 },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Maya', avatarColor: 1 },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Grandma Rosa', avatarColor: 2 },
];

const previewConversations: Conversation[] = [
  { id: '10000000-0000-0000-0000-000000000001', other: previewContacts[0], last: 'Love it here. Stay close. 🤝', lastAt: '2m' },
  { id: '10000000-0000-0000-0000-000000000004', other: previewContacts[2], last: 'Dinner Sunday?', lastAt: '1h' },
];

const previewMessages: Record<string, Message[]> = {
  '10000000-0000-0000-0000-000000000001': [
    { id: 'm1', conversationId: '10000000-0000-0000-0000-000000000001', senderId: 'you', type: 'text', content: 'Welcome to Bond, Ben! 👋', createdAt: new Date().toISOString(), mine: true, status: 'delivered' },
    { id: 'm2', conversationId: '10000000-0000-0000-0000-000000000001', senderId: 'theirs', type: 'text', content: 'Love it here. Stay close. 🤝', createdAt: new Date().toISOString(), mine: false },
    { id: 'm3', conversationId: '10000000-0000-0000-0000-000000000001', senderId: 'you', type: 'text', content: 'This is a Bond Lock message 🔒', createdAt: new Date().toISOString(), mine: true, locked: true, status: 'read' },
  ],
};

/* ------------------------------- API ----------------------------------- */

export async function listConversations(currentUserId: string): Promise<Conversation[]> {
  if (isBackendConfigured && supabase) {
    // Fetch conversations the user belongs to + their names (simplified: fetch
    // messages and derive active threads from connections is more involved; for
    // the prototype we list conversations we're a member of).
    try {
      const { data: members, error } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUserId);
      if (error) return previewConversations;
      const convIds = members?.map((m) => m.conversation_id) ?? [];
      if (convIds.length === 0) return previewConversations;
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, type, content, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });
      // Build a simple list from latest messages.
      const byConv = new Map<string, Message>();
      for (const m of msgs ?? []) {
        if (!byConv.has(m.conversation_id)) {
          byConv.set(m.conversation_id, {
            id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
            type: m.type, content: m.content, createdAt: m.created_at, mine: m.sender_id === currentUserId,
          });
        }
      }
      return Array.from(byConv.entries()).map(([id, msg]) => ({
        id,
        other: { id: 'peer', name: 'Connection', avatarColor: 0 },
        last: msg.content,
        lastAt: 'now',
      }));
    } catch {
      return previewConversations;
    }
  }
  return previewConversations;
}

export async function listMessages(conversationId: string, currentUserId: string): Promise<Message[]> {
  if (isBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error || !data) return previewMessages[conversationId] ?? [];
      return data.map((m) => ({
        id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, type: m.type,
        content: m.content, createdAt: m.created_at, mine: m.sender_id === currentUserId,
        locked: m.bond_lock, status: m.status,
      }));
    } catch {
      return previewMessages[conversationId] ?? [];
    }
    return previewMessages[conversationId] ?? [];
  }
  return previewMessages[conversationId] ?? [];
}

export async function sendText(conversationId: string, currentUserId: string, content: string): Promise<Message | null> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: currentUserId, type: 'text', content })
      .select()
      .single();
    if (error || !data) return null;
    return {
      id: data.id, conversationId, senderId: currentUserId, type: 'text', content,
      createdAt: data.created_at, mine: true, status: data.status,
    };
  }
  return {
    id: `local-${Date.now()}`, conversationId, senderId: currentUserId, type: 'text',
    content, createdAt: new Date().toISOString(), mine: true, status: 'sent',
  };
}

export function subscribeMessages(conversationId: string, currentUserId: string, onMessage: (m: Message) => void): RealtimeChannel | null {
  if (!supabase) return null;
  return supabase
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row.sender_id === currentUserId) return;
        onMessage({
          id: row.id as string, conversationId, senderId: row.sender_id as string,
          type: row.type as string, content: row.content as string || '',
          createdAt: row.created_at as string, mine: false, locked: row.bond_lock as boolean,
          status: row.status as string,
        });
      }
    )
    .subscribe();
}
