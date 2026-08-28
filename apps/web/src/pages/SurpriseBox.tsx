import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import {
  createSurprise,
  deleteSurprise,
  listSurpriseBoxes,
  openSurprise,
  type SurpriseBox,
} from '../api/surpriseBox';
import { formatDate, timeAgo } from '../utils';

const RECIPIENTS = [
  { id: 'p-alice', name: 'Alice' },
  { id: 'p-ben', name: 'Ben' },
  { id: 'p-maya', name: 'Maya' },
  { id: 'p-rosa', name: 'Rosa' },
];

const REVEAL_PRESETS = [
  { label: 'Tomorrow', ms: 1000 * 60 * 60 * 24 },
  { label: '+3 days', ms: 1000 * 60 * 60 * 24 * 3 },
  { label: '+1 week', ms: 1000 * 60 * 60 * 24 * 7 },
  { label: '+1 month', ms: 1000 * 60 * 60 * 24 * 30 },
];

export function SurpriseBoxes() {
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const [boxes, setBoxes] = useState<SurpriseBox[]>([]);
  const [opened, setOpened] = useState<Record<string, string | undefined>>({});

  const [recipient, setRecipient] = useState('p-alice');
  const [message, setMessage] = useState('');
  const [revealPicker, setRevealPicker] = useState<number>(REVEAL_PRESETS[0].ms);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    setBoxes(await listSurpriseBoxes(me));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const schedule = async () => {
    setBusy(true);
    setError(null);
    const revealAt = new Date(Date.now() + revealPicker).toISOString();
    const r = await createSurprise(me, recipient, message, revealAt);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Failed to schedule');
      return;
    }
    setMessage('');
    setNotice('Surprise box scheduled.');
    await load();
  };

  const open = async (box: SurpriseBox) => {
    const r = await openSurprise(box.id, me);
    if (!r.ok) return;
    setOpened((prev) => ({ ...prev, [box.id]: r.content }));
    await load();
  };

  const remove = async (box: SurpriseBox) => {
    await deleteSurprise(box.id, me);
    await load();
  };

  const incoming = boxes.filter((b) => b.mine);
  const sent = boxes.filter((b) => !b.mine);

  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Surprise box</h1>
        <p className="muted" style={{ fontSize: '.85rem' }}>Schedule a future message for someone — it locks until the date arrives.</p>
      </div>

      {notice ? (
        <div style={{ marginBottom: 16 }}>
          <span className="pill pill-primary">{notice}</span>
        </div>
      ) : null}

      <div className="settings-section">
        <div className="settings-title">Send a surprise</div>
        <div className="card" style={{ padding: 16 }}>
          <div className="field">
            <label className="field-label">For</label>
            <div className="seg" role="group" aria-label="Recipient">
              {RECIPIENTS.map((r) => (
                <button key={r.id} className={'seg-btn' + (recipient === r.id ? ' active' : '')} onClick={() => setRecipient(r.id)}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label">Message to reveal</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Something they should only read later…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Reveal</label>
            <div className="seg" role="group" aria-label="Reveal time">
              {REVEAL_PRESETS.map((p) => (
                <button key={p.label} className={'seg-btn' + (revealPicker === p.ms ? ' active' : '')} onClick={() => setRevealPicker(p.ms)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {error ? <div className="field-error" style={{ marginBottom: 10 }}>{error}</div> : null}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy || !message.trim()} onClick={schedule}>
            {busy ? 'Scheduling…' : '🎁 Wrap it'}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Wrapped for you ({incoming.length})</div>
        {incoming.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: '40px 24px' }}>
              <div className="empty-icon">🎀</div>
              <h3>No surprises yet</h3>
              <p>When someone schedules one for you, it waits here.</p>
            </div>
          </div>
        ) : (
          <div className="card">
            {incoming.map((box) => {
              const ready = new Date(box.revealAt).getTime() <= nowMs;
              return (
                <div key={box.id} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={box.sender.displayName} colorId={box.sender.avatarColor} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{box.sender.displayName}</div>
                      <div className="muted" style={{ fontSize: '.8rem' }}>
                        {box.opened ? 'Opened' : ready ? 'Ready to open' : `Reveals ${timeAgo(box.revealAt)}`}
                      </div>
                    </div>
                    {opened[box.id] === undefined && !box.opened ? (
                      <button className="btn btn-primary" style={{ padding: '8px 14px', width: 'auto' }} disabled={!ready} onClick={() => open(box)}>
                        {ready ? 'Open now' : '🔒 Locked'}
                      </button>
                    ) : null}
                  </div>
                  {opened[box.id] !== undefined || box.opened ? (
                    <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 14 }}>
                      <p style={{ fontStyle: 'italic' }}>“{opened[box.id] ?? box.content}”</p>
                      <p className="muted" style={{ fontSize: '.78rem', marginTop: 6 }}>Opened {box.openedAt ? formatDate(box.openedAt) : 'today'}</p>
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: '.85rem', padding: '0 4px' }}>🎁 Sealed until {formatDate(box.revealAt)}.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-title">You sent ({sent.length})</div>
        <div className="card">
          {sent.map((box) => (
            <div key={box.id} className="row" style={{ cursor: 'default' }}>
              <Avatar name={box.recipient.displayName} colorId={box.recipient.avatarColor} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>For {box.recipient.displayName}</div>
                <div className="muted" style={{ fontSize: '.78rem' }}>
                  {box.opened ? `Opened ${box.openedAt ? timeAgo(box.openedAt) : 'recently'}` : `Reveals ${timeAgo(box.revealAt)}`}
                </div>
              </div>
              {!box.opened ? (
                <button className="btn btn-danger" style={{ padding: '8px 14px', width: 'auto' }} onClick={() => remove(box)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}