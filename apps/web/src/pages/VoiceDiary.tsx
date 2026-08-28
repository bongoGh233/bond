import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import {
  createVoiceDiary,
  deleteVoiceDiary,
  listVoiceDiaries,
  type VoiceAudience,
  type VoiceDiaryEntry,
} from '../api/voiceDiary';
import { timeAgo } from '../utils';

const AUDIENCES: { key: VoiceAudience; label: string; hint: string }[] = [
  { key: 'private', label: 'Private', hint: 'Only you' },
  { key: 'connections', label: 'Connections', hint: 'Your circle' },
  { key: 'space', label: 'Shared space', hint: 'Space members' },
];

const EXPIRE_PRESETS = [
  { label: '24h', ms: 1000 * 60 * 60 * 24 },
  { label: '7 days', ms: 1000 * 60 * 60 * 24 * 7 },
  { label: 'Keep', ms: 0 },
];

function AudienceBadge({ a }: { a: VoiceAudience }) {
  const label = AUDIENCES.find((x) => x.key === a)?.label ?? a;
  return <span className="pill pill-primary" style={{ marginLeft: 8 }}>{label}</span>;
}

export function VoiceDiary() {
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const [entries, setEntries] = useState<VoiceDiaryEntry[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const [audience, setAudience] = useState<VoiceAudience>('connections');
  const [expire, setExpire] = useState<number>(EXPIRE_PRESETS[0].ms);
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setEntries(await listVoiceDiaries(me));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    };
  }, []);

  const startRecording = async () => {
    setRecordedUri(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        setRecordedUri(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
      };
      rec.start();
      setRecording(true);
      setRecordSeconds(0);
      elapsedTimer.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setError('Microphone access was denied or is unavailable in this browser.');
    }
  };

  const stopRecording = () => {
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    elapsedTimer.current = null;
    if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop();
  };

  const togglePlay = (e: VoiceDiaryEntry) => {
    if (playingId === e.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(e.voiceUri);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audioRef.current = audio;
    void audio.play().catch(() => setPlayingId(null));
    setPlayingId(e.id);
  };

  const save = async () => {
    if (!recordedUri) return;
    setBusy(true);
    setError(null);
    const r = await createVoiceDiary(me, {
      voiceUri: recordedUri,
      transcript: transcript.trim() || undefined,
      audience,
      expiresAt: expire ? new Date(Date.now() + expire).toISOString() : undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Failed to save');
      return;
    }
    if (recordedUri.startsWith('blob:')) URL.revokeObjectURL(recordedUri);
    setRecordedUri(null);
    setTranscript('');
    await load();
  };

  const remove = async (e: VoiceDiaryEntry) => {
    await deleteVoiceDiary(me, e.id);
    await load();
  };

  return (
    <div className="content" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Voice diary</h1>
        <p className="muted" style={{ fontSize: '.85rem' }}>Notes in your own voice — private, or shared with those closest to you. Uses your microphone via the browser.</p>
      </div>

      <div className="settings-section">
        <div className="settings-title">New entry</div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
            <div style={{ width: 88, height: 88, margin: '0 auto 12px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: recording ? 'var(--danger)' : 'var(--primary-soft)', color: recording ? '#fff' : 'var(--primary)', fontSize: '2rem' }}>
              {recording ? '◉' : '🎙️'}
            </div>
            {recording ? (
              <button className="btn btn-danger" onClick={stopRecording}>Stop recording</button>
            ) : recordedUri ? (
              <span className="pill pill-gold">✓ Recorded — review, then save</span>
            ) : (
              <button className="btn btn-primary" onClick={startRecording}>Start recording</button>
            )}
            <p className="muted" style={{ fontSize: '.78rem', marginTop: 8 }}>
              {recording ? `Listening… ${recordSeconds}s` : recordedUri ? 'Note ready (your microphone was used)' : 'Tap to record with your microphone'}
            </p>
          </div>

          <div className="field">
            <label className="field-label">Audience</label>
            <div className="seg" role="group" aria-label="Audience">
              {AUDIENCES.map((a) => (
                <button key={a.key} className={'seg-btn' + (audience === a.key ? ' active' : '')} onClick={() => setAudience(a.key)}>
                  {a.label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: '.76rem', marginTop: 6 }}>{AUDIENCES.find((a) => a.key === audience)?.hint}</p>
          </div>

          <div className="field">
            <label className="field-label">Expiry</label>
            <div className="seg" role="group" aria-label="Expiry">
              {EXPIRE_PRESETS.map((p) => (
                <button key={p.label} className={'seg-btn' + (expire === p.ms ? ' active' : '')} onClick={() => setExpire(p.ms)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">Transcript (optional)</label>
            <textarea
              className="input"
              rows={2}
              placeholder="What was this about?"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </div>

          {error ? <div className="field-error" style={{ marginBottom: 10 }}>{error}</div> : null}
          <button className="btn btn-primary btn-block" disabled={busy || !recordedUri} onClick={save}>
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Your diary ({entries.length})</div>
        {entries.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: '40px 24px' }}>
              <div className="empty-icon">🎧</div>
              <h3>No voice entries yet</h3>
              <p>Record your first note above.</p>
            </div>
          </div>
        ) : (
          <div className="stack">
            {entries.map((e) => (
              <div key={e.id} className="card" style={{ padding: 14, display: 'flex', gap: 12 }}>
                <Avatar name={e.authorName} colorId={e.authorAvatarColor} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {e.mine ? 'You' : e.authorName}
                    <AudienceBadge a={e.audience} />
                  </div>
                  {e.transcript ? <p style={{ marginTop: 4, fontSize: '.93rem', fontStyle: 'italic' }}>“{e.transcript}”</p> : null}
                  <p className="muted" style={{ fontSize: '.78rem', marginTop: 6 }}>
                    {timeAgo(e.createdAt)}
                    {e.expiresAt ? ` · expires ${timeAgo(e.expiresAt)}` : ''}
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', width: 'auto', alignSelf: 'center' }}
                  onClick={() => togglePlay(e)}
                >
                  {playingId === e.id ? '⏸ Pause' : '▶ Play'}
                </button>
                {e.mine ? (
                  <button className="btn btn-danger" style={{ padding: '8px 14px', width: 'auto', alignSelf: 'center' }} onClick={() => remove(e)}>
                    Delete
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