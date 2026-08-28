import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import { RecipientPicker, useRecipients } from '../components/RecipientPicker';
import {
  createBondLock,
  listIncomingBondLocks,
  listMyBondLocks,
  revokeBond,
  unlockBond,
  type BondAccessMode,
  type BondLockItem,
} from '../api/bondLock';
import { timeAgo } from '../utils';

const MODE_LABELS: Record<BondAccessMode, string> = {
  one_time: 'One-time',
  time_limited: 'Time-limited',
  each_time: 'Ask each time',
};

export function BondLock() {
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const { options: recipientOptions } = useRecipients(me);
  const [incoming, setIncoming] = useState<BondLockItem[]>([]);
  const [mine, setMine] = useState<BondLockItem[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string | undefined>>({});

  const [recipient, setRecipient] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<BondAccessMode>('one_time');
  const [hours, setHours] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [inc, my] = await Promise.all([listIncomingBondLocks(me), listMyBondLocks(me)]);
    setIncoming(inc);
    setMine(my);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (recipientOptions.length > 0 && !recipientOptions.some((o) => o.id === recipient)) {
      setRecipient(recipientOptions[0].id);
    }
  }, [recipientOptions, recipient]);

  const make = async () => {
    setBusy(true);
    setError(null);
    const r = await createBondLock(me, recipient, content, mode, mode === 'time_limited' ? hours : undefined);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Failed to create');
      return;
    }
    setContent('');
    setNotice('Bond Lock created — content is protected.');
    await load();
  };

  const open = async (item: BondLockItem) => {
    const r = await unlockBond(me, item.id);
    setRevealed((prev) => ({ ...prev, [item.id]: r.content }));
    await load();
  };

  const cancel = async (item: BondLockItem) => {
    await revokeBond(me, item.id);
    await load();
  };

  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Bond Lock</h1>
        <p className="muted" style={{ fontSize: '.85rem' }}>Lock a note for one trusted connection — it only unlocks on your terms.</p>
      </div>

      {notice ? (
        <div style={{ marginBottom: 16 }}>
          <span className="pill pill-primary">{notice}</span>
        </div>
      ) : null}

      <div className="settings-section">
        <div className="settings-title">Lock something new</div>
        <div className="card" style={{ padding: 16 }}>
          <div className="field">
            <label className="field-label">Locked for</label>
            <RecipientPicker options={recipientOptions} value={recipient} onChange={setRecipient} />
          </div>
          <div className="field">
            <label className="field-label">Protected content</label>
            <textarea
              className="input"
              rows={3}
              placeholder="A secret note, a plan, an itinerary…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Access mode</label>
            <div className="seg" role="group" aria-label="Access mode">
              {(Object.keys(MODE_LABELS) as BondAccessMode[]).map((m) => (
                <button key={m} className={'seg-btn' + (mode === m ? ' active' : '')} onClick={() => setMode(m)}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            {mode === 'time_limited' ? (
              <div className="seg" style={{ marginTop: 8 }} role="group" aria-label="Duration">
                {[1, 24, 72].map((h) => (
                  <button key={h} className={'seg-btn' + (hours === h ? ' active' : '')} onClick={() => setHours(h)}>
                    {h < 24 ? `${h}h` : h === 24 ? '1 day' : '3 days'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {error ? <div className="field-error" style={{ marginBottom: 10 }}>{error}</div> : null}
          <button className="btn btn-primary" disabled={busy || !recipient || !content.trim()} onClick={make} style={{ width: '100%' }}>
            {busy ? 'Locking…' : '🔒 Lock it'}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Unlock · locked for you ({incoming.length})</div>
        {incoming.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: '40px 24px' }}>
              <div className="empty-icon">🔒</div>
              <h3>Nothing locked for you</h3>
              <p>When someone locks a bond for you, it appears here.</p>
            </div>
          </div>
        ) : (
          <div className="card">
            {incoming.map((item) => (
              <div key={item.id} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={item.senderName} colorId={item.senderAvatarColor} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{item.senderName}</div>
                    <div className="muted" style={{ fontSize: '.8rem' }}>
                      {MODE_LABELS[item.accessMode]} · {timeAgo(item.createdAt)}
                      {item.remainUses !== undefined ? ` · ${item.remainUses} use${item.remainUses === 1 ? '' : 's'} left` : ''}
                    </div>
                  </div>
                  {!revealed[item.id] ? (
                    <button className="btn btn-primary" style={{ padding: '8px 14px', width: 'auto' }} onClick={() => open(item)}>
                      Unlock
                    </button>
                  ) : null}
                </div>
                {revealed[item.id] !== undefined ? (
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--gold)', borderRadius: 12, padding: 14 }}>
                    <div className="lock-tag" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '.8rem', marginBottom: 6 }}>🔓 Revealed</div>
                    <p>{revealed[item.id]}</p>
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: '.85rem', padding: '0 4px' }}>🔐 Content hidden — unlock to reveal.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-title">Your locked bonds ({mine.length})</div>
        {mine.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: '40px 24px' }}>
              <div className="empty-icon">🗝️</div>
              <h3>You haven't locked anything</h3>
            </div>
          </div>
        ) : (
          <div className="card">
            {mine.map((item) => (
              <div key={item.id} className="row" style={{ cursor: 'default' }}>
                <Avatar name="You" colorId={0} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="chat-name">{item.content.length > 60 ? item.content.slice(0, 60) + '…' : item.content}</div>
                  <div className="muted" style={{ fontSize: '.78rem' }}>
                    {MODE_LABELS[item.accessMode]}
                    {item.expiresAt ? ` · expires ${timeAgo(item.expiresAt)}` : ''}
                    {item.remainUses !== undefined ? ` · ${item.remainUses} uses` : ''} ·{' '}
                    <span className="primary">{item.status}</span>
                  </div>
                </div>
                {item.status === 'granted' ? (
                  <button className="btn btn-danger" style={{ padding: '8px 14px', width: 'auto' }} onClick={() => cancel(item)}>
                    Revoke
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}