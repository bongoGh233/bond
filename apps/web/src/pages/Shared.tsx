import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import {
  addBucketItem,
  addMemory,
  listBucketItems,
  listMemories,
  listSpaces,
  toggleBucketItem,
  type BucketItem,
  type Memory,
  type SharedSpace,
} from '../api/shared';
import { formatDate, timeAgo } from '../utils';

export function Shared() {
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const [space, setSpace] = useState<SharedSpace | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [bucket, setBucket] = useState<BucketItem[]>([]);

  const [note, setNote] = useState('');
  const [milestone, setMilestone] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const spaces = await listSpaces(me);
    const active = spaces[0];
    setSpace(active);
    if (!active) return;
    const [mems, items] = await Promise.all([listMemories(active.id), listBucketItems(active.id)]);
    setMemories(mems);
    setBucket(items);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Something went wrong');
    await load();
  };

  if (!space) {
    return (
      <div className="content">
        <div className="empty">
          <div className="empty-icon">📖</div>
          <h3>No shared space yet</h3>
          <p>Create a space with your connections to relive memories together.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{space.name}</h1>
        <p className="muted" style={{ fontSize: '.85rem' }}>
          {space.memberCount} members · {space.members.slice(0, 3).map((m) => m.displayName).join(', ')}
        </p>
      </div>

      {error ? (
        <div style={{ marginBottom: 16 }}>
          <span className="pill pill-warn">{error}</span>
        </div>
      ) : null}

      <div className="settings-section">
        <div className="settings-title">Memories</div>
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <textarea
            className="input"
            rows={2}
            placeholder="Drop a memory — a line, a place, a feeling…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={milestone} onChange={(e) => setMilestone(e.target.checked)} />
              Mark as milestone
            </label>
            <button
              className="btn btn-primary"
              style={{ padding: '9px 16px', width: 'auto', marginLeft: 'auto' }}
              disabled={busy || !note.trim()}
              onClick={() => { const n = note; setNote(''); run(() => addMemory(space.id, me, n, milestone)); }}
            >
              Add memory
            </button>
          </div>
        </div>
        <div className="stack">
          {memories.map((mem) => (
            <div key={mem.id} className="card" style={{ padding: 14, display: 'flex', gap: 12 }}>
              <Avatar name={mem.author?.displayName} colorId={mem.author?.avatarColor ?? 0} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '.9rem' }}>
                  {mem.author?.displayName ?? 'Someone'}
                  {mem.milestone ? <span className="pill pill-gold" style={{ marginLeft: 8 }}>★ Milestone</span> : null}
                </div>
                <p style={{ marginTop: 4, fontSize: '.93rem' }}>{mem.note}</p>
                <p className="muted" style={{ fontSize: '.76rem', marginTop: 6 }}>{timeAgo(mem.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Bucket list</div>
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <input
            className="input"
            placeholder="Something you want to do together…"
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Note (optional)"
              value={itemNote}
              onChange={(e) => setItemNote(e.target.value)}
            />
            <button
              className="btn btn-primary"
              style={{ padding: '9px 16px', width: 'auto', flexShrink: 0 }}
              disabled={busy || !itemTitle.trim()}
              onClick={() => { const t = itemTitle; const n = itemNote; setItemTitle(''); setItemNote(''); run(() => addBucketItem(space.id, me, t, n)); }}
            >
              Add
            </button>
          </div>
        </div>
        <div className="card">
          {bucket.map((b) => (
            <div key={b.id} className="row">
              <span
                className={'chip check' + (b.done ? ' checked' : '')}
                role="button"
                aria-label={b.done ? 'Mark un-done' : 'Mark done'}
                onClick={() => run(() => toggleBucketItem(space.id, b.id, me, !b.done))}
              >
                {b.done ? '✓' : ''}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, textDecoration: b.done ? 'line-through' : 'none', opacity: b.done ? .6 : 1 }}>
                  {b.title}
                </div>
                {b.note ? <div className="muted" style={{ fontSize: '.8rem' }}>{b.note}</div> : null}
              </div>
              {b.done ? <span className="pill pill-primary">Done</span> : null}
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '.76rem', marginTop: 10 }}>Bucket list last synced {formatDate(new Date().toISOString())}.</p>
      </div>
    </div>
  );
}