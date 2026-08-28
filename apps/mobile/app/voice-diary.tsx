import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import {
  listVoiceDiaries,
  createVoiceDiary,
  deleteVoiceDiary,
  type VoiceAudience,
  type VoiceDiaryEntry,
} from '@/src/api/voiceDiary';
import { useVoiceRecorder } from '@/src/hooks/useVoiceRecorder';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { Avatar } from '@/src/components/ui/Avatar';
import { Text } from '@/src/components/ui/Text';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { BondButton } from '@/src/components/ui/Button';

const EXPIRY_PRESETS: { label: string; ms: number | null }[] = [
  { label: '24h', ms: 24 * 3600_000 },
  { label: '7d', ms: 7 * 86400_000 },
  { label: 'Keep', ms: null },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function audienceLabel(a: VoiceAudience): string {
  switch (a) {
    case 'private': return 'Just me';
    case 'connections': return 'Connections';
    case 'space': return 'A shared space';
  }
}

export default function VoiceDiaryScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';

  const [entries, setEntries] = useState<VoiceDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [audience, setAudience] = useState<VoiceAudience>('private');
  const [transcript, setTranscript] = useState('');
  const [expiryMs, setExpiryMs] = useState<number | null>(24 * 3600_000);
  const [voiceUri, setVoiceUri] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const recorder = useVoiceRecorder();

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const player = useAudioPlayer(playingUri ?? null);
  const playback = useAudioPlayerStatus(player);

  const load = useCallback(async () => {
    const list = await listVoiceDiaries(me);
    setEntries(list);
  }, [me]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  // Stop the "playing" state naturally when the audio finishes.
  useEffect(() => {
    if (playback.didJustFinish || playback.error) {
      setPlayingId(null);
      setPlayingUri(null);
    }
  }, [playback.didJustFinish, playback.error]);

  const startRecord = async () => {
    if (recorder.isRecording) return;
    await recorder.start();
  };

  const stopRecord = async () => {
    await recorder.stop();
    if (recorder.uri) setVoiceUri(recorder.uri);
  };

  const save = async () => {
    if (saving || !voiceUri) return;
    setSaving(true);
    const res = await createVoiceDiary(me, {
      voiceUri,
      transcript,
      audience,
      expiresAt: expiryMs != null ? new Date(Date.now() + expiryMs).toISOString() : undefined,
    });
    setSaving(false);
    if (res.ok) {
      recorder.clearRecording();
      setVoiceUri('');
      setTranscript('');
      setAudience('private');
      await load();
    }
  };

  const togglePlay = (entry: VoiceDiaryEntry) => {
    if (playingId === entry.id) {
      player.pause();
      setPlayingId(null);
      setPlayingUri(null);
      return;
    }
    setPlayingId(entry.id);
    setPlayingUri(entry.voiceUri);
    player.seekTo(0).catch(() => {});
    player.play();
  };

  const remove = async (entry: VoiceDiaryEntry) => {
    await deleteVoiceDiary(me, entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  };

  const mine = entries.filter((e) => e.mine);
  const fromOthers = entries.filter((e) => !e.mine);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
          <ScreenHeader title="Voice Diary" subtitle="Capture moments with your voice" />
        </View>
      </View>

      {loading ? (
        <View style={{ paddingVertical: theme.spacing['3xl'], alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.layout.screenPadding,
            paddingBottom: insets.bottom + theme.spacing['3xl'],
            paddingTop: theme.spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Recorder */}
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.lg,
            }}
          >
            <Text variant="label" weight="semibold" style={{ marginBottom: theme.spacing.sm }}>
              New voice note
            </Text>

            <SegmentedControl<VoiceAudience>
              options={[
                { value: 'private', label: 'Just me' },
                { value: 'connections', label: 'Connections' },
                { value: 'space', label: 'Space' },
              ]}
              value={audience}
              onChange={setAudience}
            />

            <View
              style={{
                marginTop: theme.spacing.md,
                height: 84,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.inputBackground,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {recorder.isRecording ? (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.danger }} />
                    <Text variant="label" color="danger" weight="semibold">Recording… {Math.max(1, Math.round(recorder.durationMs / 1000))}s</Text>
                  </View>
                  <View
                    style={{
                      marginTop: theme.spacing.sm,
                      height: 6,
                      width: 180,
                      borderRadius: 3,
                      backgroundColor: theme.colors.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ width: '100%', height: 6, backgroundColor: theme.colors.danger }} />
                  </View>
                </View>
              ) : voiceUri ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons name="check-circle" size={22} color={theme.colors.success} />
                  <Text variant="label" color="success" weight="semibold" style={{ marginLeft: theme.spacing.sm }}>
                    Voice note ready — tap to re-record
                    {recorder.durationMs > 0 ? ` (${Math.max(1, Math.round(recorder.durationMs / 1000))}s)` : ''}
                  </Text>
                </View>
              ) : (
                <Text variant="caption" color="muted">
                  {recorder.error ?? 'Tap Record and speak — this uses your real microphone.'}
                </Text>
              )}

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                {recorder.isRecording ? (
                  <Pressable onPress={() => void stopRecord()} style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xxs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.danger }}>
                    <Text variant="micro" color="onPrimary" weight="semibold">Stop</Text>
                  </Pressable>
                ) : voiceUri ? (
                  <Pressable onPress={() => void startRecord()} style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xxs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySoft }}>
                    <Text variant="micro" color="primary" weight="semibold">Re-record</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => void startRecord()} style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xxs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary }}>
                    <Text variant="micro" color="onPrimary" weight="semibold">● Record</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <TextInput
              style={{
                backgroundColor: theme.colors.inputBackground,
                borderRadius: theme.radius.lg,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                color: theme.colors.text,
                fontSize: theme.typography.sizes.md,
                minHeight: 44,
                marginTop: theme.spacing.sm,
                marginBottom: theme.spacing.sm,
              }}
              placeholder="Optional transcript / caption"
              placeholderTextColor={theme.colors.textMuted}
              value={transcript}
              onChangeText={setTranscript}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
              <Text variant="micro" color="muted" style={{ marginRight: theme.spacing.xs }}>Expires</Text>
              {EXPIRY_PRESETS.map((p) => {
                const active = expiryMs === p.ms;
                return (
                  <Pressable
                    key={p.label}
                    onPress={() => setExpiryMs(p.ms)}
                    style={{
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: theme.spacing.xxs,
                      borderRadius: theme.radius.pill,
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.inputBackground,
                    }}
                  >
                    <Text variant="micro" color={active ? 'primary' : 'secondary'} weight="semibold">{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <BondButton
              label={saving ? 'Saving…' : 'Save voice note'}
              onPress={save}
              disabled={!voiceUri}
              loading={saving}
              fullWidth
            />
            <Text variant="micro" color="muted" style={{ marginTop: theme.spacing.xs }}>
              Shared to {audienceLabel(audience)}
            </Text>
          </View>

          {/* My diary */}
          <Text variant="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm }}>
            Your diary · {mine.length}
          </Text>
          {mine.length === 0 ? (
            <Text variant="body" color="muted" style={{ marginBottom: theme.spacing.lg }}>No entries yet — record one above.</Text>
          ) : (
            mine.map((e) => {
              const isPlaying = playingId === e.id;
              return (
                <View
                  key={e.id}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable
                      onPress={() => togglePlay(e)}
                      hitSlop={8}
                      accessibilityLabel="Play"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.primary,
                      }}
                    >
                      <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={24} color={theme.colors.onPrimary} />
                    </Pressable>
                    <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                      <Text variant="bodyMedium" weight="semibold" numberOfLines={1}>{e.transcript ?? 'Voice note'}</Text>
                      <Text variant="micro" color="muted">
                        {relativeTime(e.createdAt)} · {audienceLabel(e.audience)}
                        {e.expiresAt ? ` · expires ${relativeTime(e.expiresAt)}` : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => remove(e)} hitSlop={8} accessibilityLabel="Delete">
                      <MaterialIcons name="delete-outline" size={24} color={theme.colors.danger} />
                    </Pressable>
                  </View>
                  {isPlaying ? (
                    <View
                      style={{
                        marginTop: theme.spacing.sm,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: theme.colors.border,
                        overflow: 'hidden',
                      }}
                    >
                      <View style={{ width: '100%', height: 6, backgroundColor: theme.colors.primary }} />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {/* From connections */}
          <Text variant="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            Shared with you · {fromOthers.length}
          </Text>
          {fromOthers.length === 0 ? (
            <EmptyState
              icon="mic-none"
              title="Nothing shared yet"
              message="Voice entries your connections share to you will appear here."
              style={{ paddingVertical: theme.spacing['2xl'] }}
            />
          ) : (
            fromOthers.map((e) => {
              const isPlaying = playingId === e.id;
              return (
                <Pressable
                  key={e.id}
                  onPress={() => togglePlay(e)}
                  style={({ pressed }) => ({
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.sm,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Avatar spec={{ styleId: e.authorAvatarStyle, colorId: e.authorAvatarColor, initials: e.authorName }} size={40} />
                    <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                      <Text variant="bodyMedium" weight="semibold" numberOfLines={1}>{e.transcript ?? `${e.authorName}'s voice note`}</Text>
                      <Text variant="micro" color="muted">{e.authorName} · {relativeTime(e.createdAt)}</Text>
                    </View>
                    <MaterialIcons name={isPlaying ? 'pause-circle-filled' : 'play-circle-filled'} size={30} color={theme.colors.primary} />
                  </View>
                </Pressable>
              );
            })
          )}

          <Text variant="micro" color="muted" style={{ marginTop: theme.spacing.md }}>
            Voice notes use your real microphone via expo-audio. When the backend is connected they upload to Bond storage; here they stay on this device.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}