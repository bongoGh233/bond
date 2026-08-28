import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import { getAppSettings, updateAppSettings, type AppSettings } from '../api/settings';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <div className="settings-title">{title}</div>
      <div className="card">{children}</div>
    </div>
  );
}

function Row({ icon, label, value, onClick }: { icon: string; label: string; value?: string; onClick?: () => void }) {
  return (
    <div className="row" onClick={onClick}>
      <span className="row-icon">{icon}</span>
      <span className="row-label">{label}</span>
      {value ? <span className="row-value">{value}</span> : null}
      <span className="row-value">›</span>
    </div>
  );
}

function ToggleRow({ icon, label, value, on, onToggle, onLabel = 'On', offLabel = 'Off' }: {
  icon: string; label: string; value?: string; on: boolean; onToggle: () => void; onLabel?: string; offLabel?: string;
}) {
  return (
    <div className="row" onClick={onToggle} style={{ cursor: 'pointer' }}>
      <span className="row-icon">{icon}</span>
      <span className="row-label">{label}</span>
      {value ? <span className="row-value">{value}</span> : null}
      <span className={'pill ' + (on ? 'pill-primary' : '')}>{on ? onLabel : offLabel}</span>
    </div>
  );
}

export function Settings() {
  const { session, logout } = useAuth();
  const nav = useNavigate();
  const me = session?.userId ?? 'you';
  const name = session?.displayName || 'Bond Member';
  const bondId = session?.bondId || 'you';

  const [settings, setSettings] = useState<AppSettings | null>(null);

  const load = useCallback(async () => {
    setSettings(await getAppSettings(me));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key: keyof AppSettings) => {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    void updateAppSettings(me, { [key]: next[key] });
  };

  return (
    <div className="content" style={{ maxWidth: 640 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, marginBottom: 32 }}>
        <Avatar name={name} size={56} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{name}</div>
          <div className="primary">@{bondId}</div>
        </div>
      </div>

      <Group title="Account">
        <Row icon="👤" label="Profile" value="Edit display, avatar, bio" />
        <Row icon="🎫" label="Bond ID" value={bondId} />
        <Row icon="📱" label="Connected devices" value="On this device" />
      </Group>

      <Group title="Privacy">
        <Row icon="👁️" label="Profile visibility" value="Connections only" />
        <ToggleRow
          icon="💚" label="Activity status" value="Show when you're around"
          on={settings?.activityStatus ?? true} onToggle={() => toggle('activityStatus')}
        />
        <Row icon="✨" label="Moment visibility" value="Connections only" />
        <Row icon="🚫" label="Connection controls" />
      </Group>

      <Group title="Moments & care">
        <Row icon="🎙️" label="Voice diary" value="Notes in your voice" onClick={() => nav('/app/voice-diary')} />
        <Row icon="🎁" label="Surprise box" value="Future surprises" onClick={() => nav('/app/surprise-box')} />
        <Row icon="🚨" label="I Need You" value="Urgent alerts" onClick={() => nav('/app/i-need-you')} />
      </Group>

      <Group title="Notifications">
        <Row icon="🔔" label="Notification center" value="View all" onClick={() => nav('/app/notifications')} />
        <ToggleRow
          icon="🔔" label="Message notifications" value="Push when a message arrives"
          on={settings?.pushNotifications ?? true} onToggle={() => toggle('pushNotifications')}
        />
        <ToggleRow
          icon="🚨" label="I Need You" value="Urgent alerts can reach you"
          on={settings?.iNeedYou ?? true} onToggle={() => toggle('iNeedYou')}
        />
        <ToggleRow
          icon="🌙" label="Quiet hours" value="Pause non-urgent notifications"
          on={settings?.quietHours ?? false} onToggle={() => toggle('quietHours')}
        />
        <ToggleRow
          icon="🎵" label="Sounds & badges" value="Chimes for new activity"
          on={settings?.sounds ?? true} onToggle={() => toggle('sounds')}
        />
      </Group>

      <Group title="Security">
        <Row icon="🔒" label="Bond Lock & access" value="Prototype" onClick={() => nav('/app/bond-lock')} />
        <Row icon="🛡️" label="Session management" />
      </Group>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-danger btn-block" onClick={logout}>Log out</button>
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 20, fontSize: '.8rem' }}>
        Bond v0.1.0 · Private by design
      </p>
    </div>
  );
}
