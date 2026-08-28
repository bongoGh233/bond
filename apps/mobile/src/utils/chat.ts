import type { ChatMessage, MessageStatus } from '@/src/api/messages';

/**
 * A cluster of one or more consecutive messages by the same sender, sent
 * within a short window. Used to group bubbles and show a single timestamp
 * per cluster (like most instant messengers).
 */
export interface MessageGroup {
  senderId: string;
  mine: boolean;
  messages: ChatMessage[];
  /** ISO timestamp of the first message in the group. */
  firstAt: string;
  /** ISO timestamp of the last message in the group. */
  lastAt: string;
}

export type ChatRow =
  | { kind: 'date'; label: string; at: string }
  | { kind: 'group'; group: MessageGroup };

/** Consecutive messages by the same sender within this window form one group. */
const GROUP_WINDOW_MS = 10 * 60 * 1000;

function sameSender(a: ChatMessage, b: ChatMessage): boolean {
  return a.senderId === b.senderId;
}

function withinWindow(a: ChatMessage, b: ChatMessage): boolean {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() <= GROUP_WINDOW_MS;
}

function dateKey(iso: string): string {
  return new Date(iso).toDateString();
}

function isNewDay(prev: string, next: string): boolean {
  return dateKey(prev) !== dateKey(next);
}

/**
 * Build the FlatList rows: date dividers + message groups.
 */
export function buildChatRows(messages: ChatMessage[], myId: string): ChatRow[] {
  const rows: ChatRow[] = [];
  if (messages.length === 0) return rows;

  let current: MessageGroup | null = null;
  let prevDateKey = '';

  for (const m of messages) {
    if (current && sameSender(current.messages[current.messages.length - 1], m) && withinWindow(current.messages[current.messages.length - 1], m)) {
      current.messages.push(m);
      current.lastAt = m.createdAt;
      continue;
    }

    if (current && isNewDay(current.lastAt, m.createdAt)) {
      rows.push({ kind: 'date', label: formatDayLabel(m.createdAt), at: m.createdAt });
      prevDateKey = dateKey(m.createdAt);
    } else if (rows.length === 0) {
      rows.push({ kind: 'date', label: formatDayLabel(m.createdAt), at: m.createdAt });
      prevDateKey = dateKey(m.createdAt);
    }

    current = {
      senderId: m.senderId,
      mine: m.senderId === myId,
      messages: [m],
      firstAt: m.createdAt,
      lastAt: m.createdAt,
    };
    rows.push({ kind: 'group', group: current });
  }

  return rows;
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (sameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Compact time, e.g. "9:41 AM". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Human label + icon + color hint for a message status. */
export function statusPresentation(status: MessageStatus): { label: string } {
  switch (status) {
    case 'sent':
      return { label: 'Sent' };
    case 'delivered':
      return { label: 'Delivered' };
    case 'read':
      return { label: 'Read' };
    case 'failed':
      return { label: 'Failed' };
    default:
      return { label: 'Sent' };
  }
}
