import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import {
  listConnections,
  listRequests,
  removeConnection,
  respondRequest,
  searchBondId,
  sendRequest,
  type ConnectionRequest,
  type ConnectionUser,
  type OutgoingRequest,
} from '../api/connections';

export function Connections() {
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const [connected, setConnected] = useState<ConnectionUser[]>([]);
  const [incoming, setIncoming] = useState<ConnectionRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConnectionUser[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [conns, reqs] = await Promise.all([listConnections(me), listRequests(me)]);
    setConnected(conns);
    setIncoming(reqs.incoming);
    setOutgoing(reqs.outgoing);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim()) {
        setResults(await searchBondId(me, query));
      } else {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, me]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => {
    const r = await fn();
    setNotice(r.ok ? msg : (r.error ?? 'Something went wrong'));
    await load();
    setResults(await searchBondId(me, query));
  };

  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Connections</h1>
        <p className="muted" style={{ fontSize: '.85rem' }}>Your trusted circle — manage requests and people you're close with.</p>
      </div>

      {notice ? (
        <div style={{ marginBottom: 16 }}>
          <span className="pill pill-primary">{notice}</span>
        </div>
      ) : null}

      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <input
            className="input"
            placeholder="Search by Bond ID or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {results.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            {results.map((u) => (
              <div key={u.id} className="row" style={{ cursor: 'default' }}>
                <Avatar name={u.displayName} colorId={u.avatarColor} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                  <div className="muted" style={{ fontSize: '.8rem' }}>@{u.bondId}{u.bio ? ` · ${u.bio}` : ''}</div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', width: 'auto' }}
                  onClick={() => act(() => sendRequest(me, u.id), `Request sent to ${u.displayName}`)}
                >
                  Connect
                </button>
              </div>
            ))}
          </div>
        ) : query.trim() ? (
          <p className="muted" style={{ marginTop: 10, fontSize: '.85rem' }}>No new people match — try another name.</p>
        ) : null}
      </div>

      {incoming.length > 0 ? (
        <div className="settings-section">
          <div className="settings-title">Requests for you</div>
          <div className="card">
            {incoming.map((r) => (
              <div key={r.id} className="row" style={{ cursor: 'default' }}>
                <Avatar name={r.user.displayName} colorId={r.user.avatarColor} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{r.user.displayName}</div>
                  <div className="muted" style={{ fontSize: '.8rem' }}>@{r.user.bondId}</div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', width: 'auto' }}
                  onClick={() => act(() => respondRequest(me, r.id, 'accept'), `${r.user.displayName} added`)}
                >
                  Accept
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', width: 'auto' }}
                  onClick={() => act(() => respondRequest(me, r.id, 'decline'), 'Request declined')}
                >
                  Decline
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {outgoing.length > 0 ? (
        <div className="settings-section">
          <div className="settings-title">Sent requests</div>
          <div className="card">
            {outgoing.map((r) => (
              <div key={r.id} className="row" style={{ cursor: 'default' }}>
                <Avatar name={r.user.displayName} colorId={r.user.avatarColor} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{r.user.displayName}</div>
                  <div className="muted" style={{ fontSize: '.8rem' }}>Awaiting response</div>
                </div>
                <span className="pill pill-gold">Pending</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="settings-section">
        <div className="settings-title">Your connections ({connected.length})</div>
        {connected.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: '48px 24px' }}>
              <div className="empty-icon">👥</div>
              <h3>No connections yet</h3>
              <p>Search above to reach someone, or accept an incoming request.</p>
            </div>
          </div>
        ) : (
          <div className="card">
            {connected.map((c) => (
              <div key={c.id} className="row" style={{ cursor: 'default' }}>
                <Avatar name={c.displayName} colorId={c.avatarColor} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{c.displayName}</div>
                  <div className="muted" style={{ fontSize: '.8rem' }}>@{c.bondId}{c.bio ? ` · ${c.bio}` : ''}</div>
                </div>
                <button
                  className="btn btn-danger"
                  style={{ padding: '8px 14px', width: 'auto' }}
                  onClick={() => act(() => removeConnection(me, c.id), `${c.displayName} removed`)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}