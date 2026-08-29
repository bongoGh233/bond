import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import {
  listConversations,
  listMessages,
  sendText,
  subscribeMessages,
  type Conversation,
  type Message,
} from '../chats';

export function Chats() {
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    listConversations(me).then((c) => {
      setConversations(c);
      const m = window.location.hash.match(/[?&]convo=([0-9a-f-]+)/i);
      const preset = m ? m[1] : null;
      if (preset && c.some((x) => x.id === preset)) {
        setActiveId(preset);
      } else if (c.length) {
        setActiveId(c[0].id);
      }
    });
  }, [me]);

  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    listMessages(activeId, me).then(setMessages);
    const ch = subscribeMessages(activeId, me, (m) => setMessages((prev) => [...prev, m]));
    return () => { ch?.unsubscribe(); };
  }, [activeId]);

  const active = conversations.find((c) => c.id === activeId);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !activeId) return;
    setDraft('');
    const sent = await sendText(activeId, me, text);
    if (sent) setMessages((prev) => [...prev, sent]);
  };

  return (
    <div className="content" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="chats-split">
        {/* List */}
        <div className="chatlist">
          <div className="chatlist-head">
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Chats</h1>
            <p className="muted" style={{ fontSize: '.85rem' }}>Conversations with your connections</p>
          </div>
          {conversations.length === 0 ? (
            <div className="empty"><div className="empty-icon">💬</div><h3>No conversations yet</h3>
              <p>Open Connections and tap Message next to someone to start chatting.</p></div>
          ) : (
            conversations.map((c) => (
              <div key={c.id} className={'chat-preview' + (c.id === activeId ? ' active' : '')}
                onClick={() => setActiveId(c.id)}>
                <Avatar name={c.other.name} colorId={c.other.avatarColor} />
                <div className="chat-info">
                  <div className="chat-name">{c.other.name}</div>
                  <div className="chat-last">{c.last || 'Tap to open'}</div>
                </div>
                {c.lastAt ? <span className="chat-time">{c.lastAt}</span> : null}
              </div>
            ))
          )}
        </div>

        {/* Thread */}
        <div className="thread">
          {!active ? (
            <div className="empty"><div className="empty-icon">👈</div><h3>Select a conversation</h3>
              <p>Choose a chat to view and send messages.</p></div>
          ) : (
            <>
              <div className="thread-head">
                <Avatar name={active.other.name} colorId={active.other.avatarColor} />
                <div>
                  <div style={{ fontWeight: 700 }}>{active.other.name}</div>
                  <div className="muted" style={{ fontSize: '.8rem' }}>
                    <span className="status-dot" style={{ background: 'var(--success)' }} /> Connected
                  </div>
                </div>
              </div>
              <div className="thread-messages">
                {messages.map((m) => (
                  <div key={m.id} className={'msg ' + (m.mine ? 'msg-mine' : 'msg-theirs') + (m.locked ? ' msg-locked' : '')}>
                    {m.locked ? (
                      <div className="lock-tag">🔒 Bond Lock — protected</div>
                    ) : null}
                    {m.content}
                    <div className="msg-meta">
                      {m.mine ? `✓${m.status === 'read' ? '✓' : ''} ` : ''}
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="thread-input">
                <input placeholder="Message…" value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
                <button className="send-btn" onClick={submit} aria-label="Send">➤</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
