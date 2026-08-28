import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import {
  createPhotoMoment,
  createTextMoment,
  deleteMoment,
  listFeedMoments,
  viewMoment,
  type Moment,
  type MomentDuration,
} from '../api/moments';
import { objectUrlFor } from '../api/media';
import { timeAgo } from '../utils';

const DURATIONS: { key: MomentDuration; label: string }[] = [
  { key: 'short', label: '12m' },
  { key: 'hour', label: '1h' },
  { key: 'day', label: '24h' },
  { key: 'permanent', label: 'Keep' },
];

function MomentCard({ m, onDelete, onView }: { m: Moment; onDelete: () => void; onView: () => void }) {
  const hasImage = Boolean(m.mediaMetadata?.uri && m.mediaMetadata.uri.startsWith('http'));
  const [seen, setSeen] = useState(m.mine || m.viewerIds.length > 0);
  return (
    <div className="card moment-card" onClick={() => { if (!seen) { setSeen(true); onView(); } }}>
      {hasImage ? (
        <img src={m.mediaMetadata!.uri} alt={m.caption || 'Moment'} style={{ width: '100%', height: 220, objectFit: 'cover' }} />
      ) : m.type === 'image' ? (
        <div style={{ height: 120, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--text-muted)' }}>📷</div>
      ) : null}
      <div style={{ display: 'flex', gap: 12, padding: 14 }}>
        <Avatar name={m.author?.displayName} colorId={m.author?.avatarColor ?? 0} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>
            {m.mine ? 'You' : (m.author?.displayName ?? 'Someone')}
            <span className="pill pill-gold" style={{ marginLeft: 8 }}>{m.duration === 'permanent' ? 'Keep' : `exp ${timeAgo(m.expiresAt || m.createdAt)}`}</span>
          </div>
          {m.caption ? <p style={{ marginTop: 4, fontSize: '.93rem' }}>{m.caption}</p> : null}
          <p className="muted" style={{ fontSize: '.78rem', marginTop: 6 }}>
            {timeAgo(m.createdAt)} · {m.viewCount} {m.viewCount === 1 ? 'view' : 'views'}
          </p>
        </div>
        {m.mine ? (
          <button className="btn btn-danger" style={{ padding: '6px 12px', width: 'auto' }} onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Moments() {
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const [moments, setMoments] = useState<Moment[]>([]);
  const [caption, setCaption] = useState('');
  const [duration, setDuration] = useState<MomentDuration>('hour');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setMoments(await listFeedMoments(me));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    setBusy(true);
    setError(null);
    const r = image
      ? await createPhotoMoment(me, image, caption, duration)
      : await createTextMoment(me, caption, duration);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Failed to post');
      return;
    }
    setCaption('');
    setImage(null);
    if (fileRef.current) fileRef.current.value = '';
    await load();
  };

  const onDelete = async (m: Moment) => {
    await deleteMoment(me, m.id);
    await load();
  };

  const onView = async (m: Moment) => {
    await viewMoment(me, m.id);
    await load();
  };

  return (
    <div className="content" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Moments</h1>
        <p className="muted" style={{ fontSize: '.85rem' }}>Share updates that fade on your terms — seen by the people you trust.</p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 28 }}>
        <textarea
          className="input"
          rows={2}
          placeholder="What's on your mind?"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <div className="seg" role="group" aria-label="Moment duration">
            {DURATIONS.map((d) => (
              <button
                key={d.key}
                className={'seg-btn' + (duration === d.key ? ' active' : '')}
                onClick={() => setDuration(d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => setImage(e.target.files?.[0] ? objectUrlFor(e.target.files[0]) : null)}
          />
          <button className="btn btn-secondary" style={{ padding: '9px 14px', width: 'auto' }} onClick={() => fileRef.current?.click()}>
            {image ? '🖼️ Attached' : 'Add photo'}
          </button>
          <button className="btn btn-primary" style={{ padding: '9px 16px', width: 'auto', marginLeft: 'auto' }} disabled={busy || (!caption.trim() && !image)} onClick={post}>
            {busy ? 'Posting…' : 'Share moment'}
          </button>
        </div>
        {error ? <div className="field-error" style={{ marginTop: 10 }}>{error}</div> : null}
      </div>

      {moments.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">✨</div>
            <h3>No moments yet</h3>
            <p>Share the first update for your circle.</p>
          </div>
        </div>
      ) : (
        <div className="stack">
          {moments.map((m) => (
            <MomentCard key={m.id} m={m} onDelete={() => onDelete(m)} onView={() => onView(m)} />
          ))}
        </div>
      )}
    </div>
  );
}