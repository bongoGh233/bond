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

/* ------------------------------- API ----------------------------------- */

export async function listConversations(currentUserId: string): Promise<Conversation[]> {
  if (isBackendConfigured && supabase) {
    try {
      const { data: members, error } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUserId);
      if (error) return [];
      const convIds = members?.map((m) => m.conversation_id) ?? [];
      if (convIds.length === 0) return [];

      // Resolve the peer (other participant) for each direct conversation.
      const { data: peers } = await supabase
        .from('conversation_members')
        .select('conversation_id, profile:profiles!conversation_members_user_id_fkey(id, display_name, avatar_color)')
        .in('conversation_id', convIds)
        .neq('user_id', currentUserId);
      const peerById = new Map<string, Contact>();
      for (const p of peers ?? []) {
        const prof = p.profile as unknown as { id: string; display_name: string; avatar_color: number } | null;
        if (prof && !peerById.has(p.conversation_id)) {
          peerById.set(p.conversation_id, { id: prof.id, name: prof.display_name, avatarColor: prof.avatar_color ?? 0 });
        }
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, type, content, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });

      const byConv = new Map<string, Message>();
      for (const m of msgs ?? []) {
        if (!byConv.has(m.conversation_id)) {
          byConv.set(m.conversation_id, {
            id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
            type: m.type, content: m.content, createdAt: m.created_at, mine: m.sender_id === currentUserId,
          });
        }
      }

      return Array.from(byConv.entries())
        .map(([id, msg]) => {
          const other = peerById.get(id);
          return {
            id,
            other: other ?? { id: 'unknown', name: 'Connection', avatarColor: 0 },
            last: msg.content,
            lastAt: new Date(msg.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit' }),
          };
        })
        .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
    } catch {
      return [];
    }
  }
  return [];
}

export async function listMessages(conversationId: string, currentUserId: string): Promise<Message[]> {
  if (isBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error || !data) return [];
      return data.map((m) => ({
        id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, type: m.type,
        content: m.content, createdAt: m.created_at, mine: m.sender_id === currentUserId,
        locked: m.bond_lock, status: m.status,
      }));
    } catch {
      return [];
    }
  }
  return [];
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
  return null;
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