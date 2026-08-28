import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import {
  listSurpriseBoxes,
  createSurprise,
  openSurprise,
  deleteSurprise,
  type SurpriseBox,
} from '@/src/api/surpriseBox';
import { listConnections, type ConnectionUser } from '@/src/api/connections';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { Avatar } from '@/src/components/ui/Avatar';
import { Text } from '@/src/components/ui/Text';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { BondButton } from '@/src/components/ui/Button';

const PRESETS: { label: string; ms: number }[] = [
  { label: 'Tomorrow', ms: 86400_000 },
  { label: '+3 days', ms: 3 * 86400_000 },
  { label: '+1 week', ms: 7 * 86400_000 },
  { label: '+1 month', ms: 30 * 86400_000 },
];

function formatReveal(iso: string): string {
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return 'Ready to open';
  const days = Math.floor(diff / 86400_000);
  const hrs = Math.floor((diff % 86400_000) / 3600_000);
  if (days > 0) return `opens in ${days}d ${hrs}h`;
  return `opens in ${hrs}h`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function SurpriseBoxScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';

  const [boxes, setBoxes] = useState<SurpriseBox[]>([]);
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [recipientId, setRecipientId] = useState<string>('');
  const [content, setContent] = useState('');
  const [revealAt, setRevealAt] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState<{ id: string; content: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const incoming = useMemo(() => boxes.filter((b) => b.mine), [boxes]);
  const sent = useMemo(() => boxes.filter((b) => !b.mine), [boxes]);

  const load = useCallback(async () => {
    const [list, conns] = await Promise.all([listSurpriseBoxes(me), listConnections(me)]);
    setBoxes(list);
    setConnections(conns);
  }, [me]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const res = await createSurprise(me, recipientId, content, revealAt);
    setSaving(false);
    if (res.ok) {
      setContent('');
      setRevealAt('');
      setRecipientId('');
      await load();
    }
  };

  const open = async (b: SurpriseBox) => {
    if (busyId) return;
    setBusyId(b.id);
    const res = await openSurprise(b.id, me);
    setBusyId(null);
    if (res.ok && res.content) {
      setOpened({ id: b.id, content: res.content });
      setBoxes((prev) => prev.map((x) => (x.id === b.id ? { ...x, opened: true } : x)));
    }
  };

  const remove = async (b: SurpriseBox) => {
    if (busyId) return;
    setBusyId(b.id);
    await deleteSurprise(b.id, me);
    setBusyId(null);
    setBoxes((prev) => prev.filter((x) => x.id !== b.id));
  };

  const recipientName = connections.find((c) => c.id === recipientId)?.displayName;

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
          <ScreenHeader title="Surprise Box" subtitle="Time-capsuled messages for loved ones" />
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
          {/* Composer */}
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
              Send a surprise
            </Text>

            <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.xs }}>Who it is for</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
              {connections.map((c) => {
                const active = c.id === recipientId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setRecipientId(c.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: theme.spacing.xxs,
                      borderRadius: theme.radius.pill,
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.inputBackground,
                    }}
                  >
                    <Avatar spec={{ styleId: c.avatarStyle, colorId: c.avatarColor, initials: c.displayName }} size={20} />
                    <Text variant="micro" color={active ? 'primary' : 'secondary'} weight="semibold" style={{ marginLeft: 6 }}>
                      {c.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TextInput
              style={{
                backgroundColor: theme.colors.inputBackground,
                borderRadius: theme.radius.lg,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                color: theme.colors.text,
                fontSize: theme.typography.sizes.md,
                minHeight: 44,
                marginBottom: theme.spacing.sm,
              }}
              placeholder="A message for the future…"
              placeholderTextColor={theme.colors.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
            />

            <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.xs }}>Reveal on</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
              {PRESETS.map((p) => {
                const t = new Date(Date.now() + p.ms).toISOString();
                const active = revealAt === t;
                return (
                  <Pressable
                    key={p.label}
                    onPress={() => setRevealAt(t)}
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
              label={saving ? 'Saving…' : recipientName ? `Hide it for ${recipientName}` : 'Pick who it is for'}
              onPress={save}
              disabled={!recipientId || !content.trim() || !revealAt}
              loading={saving}
              fullWidth
            />
          </View>

          {/* For you */}
          <Text variant="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm }}>
            For you · {incoming.length}
          </Text>
          {incoming.length === 0 ? (
            <EmptyState
              icon="redeem"
              title="No surprises yet"
              message="Time-capsuled messages sent to you will wait here until their reveal time."
              style={{ paddingVertical: theme.spacing['2xl'] }}
            />
          ) : (
            incoming.map((b) => {
              const ready = new Date(b.revealAt).getTime() <= Date.now();
              const isOpen = opened?.id === b.id;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => open(b)}
                  disabled={!ready || b.opened || busyId != null}
                  style={({ pressed }) => ({
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: ready && !b.opened ? theme.colors.primarySoft : theme.colors.border,
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.sm,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isOpen ? theme.spacing.sm : 0 }}>
                    <Avatar spec={{ styleId: b.sender.avatarStyle, colorId: b.sender.avatarColor, initials: b.sender.displayName }} size={40} />
                    <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                      <Text variant="bodyMedium" weight="semibold">{b.sender.displayName}</Text>
                      <Text variant="micro" color="muted">
                        {relativeTime(b.createdAt)} · {b.opened ? 'opened' : formatReveal(b.revealAt)}
                      </Text>
                    </View>
                    {b.opened ? (
                      <MaterialIcons name="check-circle" size={24} color={theme.colors.success} />
                    ) : ready ? (
                      <MaterialIcons name={busyId === b.id ? 'hourglass-empty' : 'redeem'} size={24} color={theme.colors.primary} />
                    ) : (
                      <MaterialIcons name="schedule" size={24} color={theme.colors.textMuted} />
                    )}
                  </View>
                  {isOpen && opened ? (
                    <View style={{ backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.lg, padding: theme.spacing.sm }}>
                      <Text variant="body" color="secondary">{opened.content}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}

          {/* Sent */}
          <Text variant="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            You've hidden · {sent.length}
          </Text>
          {sent.length === 0 ? (
            <Text variant="body" color="muted">Nothing hidden yet — create one above.</Text>
          ) : (
            sent.map((b) => (
              <View
                key={b.id}
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
                  <MaterialIcons name="redeem" size={22} color={theme.colors.primary} />
                  <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                    <Text variant="bodyMedium" weight="semibold" numberOfLines={1}>{b.content}</Text>
                    <Text variant="micro" color="muted">for {b.recipient.displayName} · {formatReveal(b.revealAt)}</Text>
                  </View>
                  {!b.opened ? (
                    <Pressable onPress={() => remove(b)} hitSlop={8} disabled={busyId != null} accessibilityLabel="Delete">
                      <MaterialIcons name={busyId === b.id ? 'hourglass-empty' : 'delete-outline'} size={24} color={theme.colors.danger} />
                    </Pressable>
                  ) : (
                    <Text variant="micro" color="muted">opened</Text>
                  )}
                </View>
              </View>
            ))
          )}

          <Text variant="micro" color="muted" style={{ marginTop: theme.spacing.md }}>
            Surprise Box lets you leave a message that's revealed on a future date. The sender can remove it before it opens.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
