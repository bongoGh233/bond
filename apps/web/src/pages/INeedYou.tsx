import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import { RecipientPicker, useRecipients } from '../components/RecipientPicker';
import {
  acknowledgeAlert,
  getINeedYouPrefs,
  listINeedYouAlerts,
  sendINeedYouAlert,
  subscribeToAlerts,
  updateINeedYouPrefs,
  type AckAction,
  type INeedYouAlert,
  type INeedYouPrefs,
} from '../api/iNeedYou';
import { timeAgo } from '../utils';

const ACK_LABELS: Record<AckAction, string> = {
  im_here: 'I’m here',
  will_respond: 'Will respond',
  answered: 'Answered',
};

function AlertCard({ a, onAck }: { a: INeedYouAlert; onAck: (action: AckAction) => void }) {
  if (!a.forMe) return null;
  const pending = a.status === 'pending';
  return (
    <div className={'card alert-card' + (pending ? ' urgent' : '')}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Avatar name={a.requester.displayName} colorId={a.requester.avatarColor} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>
            {a.requester.displayName}
            {pending ? <span className="pill pill-warn" style={{ marginLeft: 8 }}>Needs you</span> : <span className="pill pill-primary" style={{ marginLeft: 8 }}>{a.ackAction ? ACK_LABELS[a.ackAction] : a.status}</span>}
          </div>
          <p style={{ marginTop: 4, fontSize: '.95rem' }}>{a.message}</p>
          <p className="muted" style={{ fontSize: '.78rem', marginTop: 6 }}>{timeAgo(a.createdAt)}</p>
        </div>
      </div>
      {pending ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {(Object.keys(ACK_LABELS) as AckAction[]).map((act) => (
            <button key={act} className="btn btn-secondary" style={{ padding: '8px 14px', width: 'auto' }} onClick={() => onAck(act)}>
              {ACK_LABELS[act]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function INeedYou() {
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const { options: recipientOptions } = useRecipients(me);
  const [alerts, setAlerts] = useState<INeedYouAlert[]>([]);
  const [prefs, setPrefs] = useState<INeedYouPrefs>({ optIn: false, quietHours: { enabled: false } });

  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [al, pr] = await Promise.all([listINeedYouAlerts(me), getINeedYouPrefs(me)]);
    setAlerts(al);
    setPrefs(pr);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (recipientOptions.length > 0 && !recipientOptions.some((o) => o.id === recipient)) {
      setRecipient(recipientOptions[0].id);
    }
  }, [recipientOptions, recipient]);

  useEffect(() => {
    return subscribeToAlerts(me, () => {
      void load();
    });
  }, [me, load]);

  const toggleOptIn = async (opted: boolean) => {
    const next = { ...prefs, optIn: opted };
    setPrefs(next);
    await updateINeedYouPrefs(me, next);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    const r = await sendINeedYouAlert(me, recipient, message);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Failed to send');
      return;
    }
    setMessage('');
    await load();
  };

  const ack = async (alert: INeedYouAlert, action: AckAction) => {
    await acknowledgeAlert(me, alert.id, action);
    await load();
  };

  const alertsForMe = alerts.filter((a) => a.forMe);
  const history = alerts.filter((a) => a.status !== 'pending');

  return (
    <div className="content" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>I Need You</h1>
        <p className="muted" style={{ fontSize: '.85rem' }}>An urgent, focused alert for the people who matter — opt in to be reachable.</p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <div className="row" style={{ padding: 0, cursor: 'pointer' }} onClick={() => toggleOptIn(!prefs.optIn)}>
          <span className="row-icon">🚨</span>
          <span className="row-label">I can be alerted when someone needs me</span>
          <span className={'pill ' + (prefs.optIn ? 'pill-primary' : '')}>{prefs.optIn ? 'Opted in' : 'Off'}</span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Send an alert</div>
        <div className="card" style={{ padding: 16 }}>
          <div className="field">
            <label className="field-label">Alert</label>
            <RecipientPicker options={recipientOptions} value={recipient} onChange={setRecipient} />
          </div>
          <div className="field">
            <label className="field-label">Message</label>
            <input
              className="input"
              placeholder="I need you — can you call me?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          {error ? <div className="field-error" style={{ marginBottom: 10 }}>{error}</div> : null}
          <button
            className="btn btn-danger btn-block"
            disabled={busy || !recipient || !message.trim()}
            onClick={send}
          >
            {busy ? 'Sending…' : '🚨 Send alert'}
          </button>
          <p className="muted" style={{ fontSize: '.74rem', marginTop: 8 }}>
            {prefs.optIn ? 'Pick an opted-in connection below — they are alerted instantly.' : 'You are currently opted out — others cannot alert you, but you can still reach out.'}
          </p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Alerts for you ({alertsForMe.length})</div>
        {alertsForMe.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: '40px 24px' }}>
              <div className="empty-icon">📭</div>
              <h3>Nothing urgent</h3>
              <p>When someone needs you, it shows here so you can respond fast.</p>
            </div>
          </div>
        ) : (
          <div className="stack">
            {alertsForMe.map((a) => (
              <AlertCard key={a.id} a={a} onAck={(act) => ack(a, act)} />
            ))}
          </div>
        )}
      </div>

      {history.length > 0 ? (
        <div className="settings-section">
          <div className="settings-title">Recent activity</div>
          <div className="card">
            {history.map((a) => (
              <div key={a.id} className="row" style={{ cursor: 'default' }}>
                <Avatar name={a.forMe ? a.requester.displayName : a.recipient.displayName} colorId={a.forMe ? a.requester.avatarColor : a.recipient.avatarColor} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.9rem', fontWeight: 600 }}>
                    {a.forMe ? a.requester.displayName : a.recipient.displayName}
                  </div>
                  <div className="muted" style={{ fontSize: '.78rem' }}>{a.message}</div>
                </div>
                <span className="pill pill-primary">{a.ackAction ? ACK_LABELS[a.ackAction] : a.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}