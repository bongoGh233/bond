import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import {
  listBondLocks,
  listIncomingBondLocks,
  listMyBondLocks,
  createBondLock,
  unlockBond,
  revokeBond,
  type BondAccessMode,
  type BondLockItem,
} from '@/src/api/bondLock';
import { listConnections, type ConnectionUser } from '@/src/api/connections';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { Avatar } from '@/src/components/ui/Avatar';
import { Text } from '@/src/components/ui/Text';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { BondButton } from '@/src/components/ui/Button';

const MODES: { value: BondAccessMode; label: string }[] = [
  { value: 'one_time', label: 'Once' },
  { value: 'time_limited', label: 'Timed' },
  { value: 'each_time', label: 'Repeat' },
];

function accessLabel(mode: BondAccessMode): string {
  switch (mode) {
    case 'one_time': return 'One-time access';
    case 'time_limited': return 'Time limited';
    case 'each_time': return 'Each time';
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function BondLockScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';

  const [items, setItems] = useState<BondLockItem[]>([]);
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [recipientId, setRecipientId] = useState<string>('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<BondAccessMode>('one_time');
  const [hours, setHours] = useState('24');
  const [locking, setLocking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const incoming = useMemo(() => items.filter((i) => !i.isMine && i.status === 'granted'), [items]);
  const mine = useMemo(() => items.filter((i) => i.isMine), [items]);

  const load = useCallback(async () => {
    const [locks, conns] = await Promise.all([listBondLocks(me), listConnections(me)]);
    setItems(locks);
    setConnections(conns);
  }, [me]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const doUnlock = async (item: BondLockItem) => {
    if (busyId) return;
    setBusyId(item.id);
    const res = await unlockBond(me, item.id);
    setBusyId(null);
    if (res.ok && res.content) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'expired' as const, remainUses: 0 } : i)));
      setRevealed({ id: item.id, content: res.content });
      setTimeout(() => setRevealed(null), 6000);
    }
  };

  const [revealed, setRevealed] = useState<{ id: string; content: string } | null>(null);

  const doRevoke = async (item: BondLockItem) => {
    if (busyId) return;
    setBusyId(item.id);
    await revokeBond(me, item.id);
    setBusyId(null);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'revoked' as const } : i)));
  };

  const doLock = async () => {
    if (locking) return;
    setLocking(true);
    const res = await createBondLock(me, recipientId, content, mode, mode === 'time_limited' ? Number(hours) || undefined : undefined);
    setLocking(false);
    if (res.ok) {
      setContent('');
      await load();
    }
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
          <ScreenHeader title="Bond Lock" subtitle="Protected, permission-gated sharing" />
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
              Lock something new
            </Text>

            <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.xs }}>Who can unlock it</Text>
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
              placeholder="Protected content — e.g. the surprise for Friday"
              placeholderTextColor={theme.colors.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
              {MODES.map((m) => {
                const active = m.value === mode;
                return (
                  <Pressable
                    key={m.value}
                    onPress={() => setMode(m.value)}
                    style={{
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: theme.spacing.xxs,
                      borderRadius: theme.radius.pill,
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.inputBackground,
                    }}
                  >
                    <Text variant="micro" color={active ? 'primary' : 'secondary'} weight="semibold">{m.label}</Text>
                  </Pressable>
                );
              })}
              {mode === 'time_limited' ? (
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.colors.inputBackground,
                    borderRadius: theme.radius.pill,
                    paddingHorizontal: theme.spacing.sm,
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: theme.colors.text, fontSize: theme.typography.sizes.sm, paddingVertical: theme.spacing.xxs }}
                    value={hours}
                    onChangeText={setHours}
                    keyboardType="number-pad"
                    placeholder="hrs"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                  <Text variant="micro" color="muted">hrs</Text>
                </View>
              ) : null}
            </View>

            <BondButton
              label={locking ? 'Locking…' : recipientName ? `Lock for ${recipientName}` : 'Choose who to lock for'}
              onPress={doLock}
              disabled={!recipientId || !content.trim()}
              loading={locking}
              fullWidth
            />
          </View>

          {/* Incoming */}
          <Text variant="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm }}>
            Sent to you · {incoming.length}
          </Text>
          {incoming.length === 0 ? (
            <EmptyState
              icon="lock-outline"
              title="Nothing locked for you"
              message="Bonds your trusted connections protect will appear here, ready to unlock."
              style={{ paddingVertical: theme.spacing['2xl'] }}
            />
          ) : (
            incoming.map((item) => {
              const isOpen = revealed?.id === item.id;
              const locked = item.status === 'granted';
              return (
                <Pressable
                  key={item.id}
                  onPress={() => doUnlock(item)}
                  disabled={!locked || busyId != null}
                  style={({ pressed }) => ({
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: locked ? theme.colors.primarySoft : theme.colors.border,
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.sm,
                    opacity: pressed || !locked ? 0.9 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isOpen ? theme.spacing.sm : 0 }}>
                    <Avatar spec={{ styleId: item.senderAvatarStyle, colorId: item.senderAvatarColor, initials: item.senderName }} size={40} />
                    <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                      <Text variant="bodyMedium" weight="semibold">{item.senderName}</Text>
                      <Text variant="micro" color="muted">
                        {relativeTime(item.createdAt)} · {accessLabel(item.accessMode)}
                        {item.accessToken ? ` · token ${item.accessToken}` : ''}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={locked ? (busyId === item.id ? 'hourglass-empty' : 'lock-open') : 'lock'}
                      size={22}
                      color={locked ? theme.colors.primary : theme.colors.textMuted}
                    />
                  </View>
                  {isOpen && revealed ? (
                    <View style={{ backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.lg, padding: theme.spacing.sm }}>
                      <Text variant="body" color="secondary">{revealed.content}</Text>
                      <Text variant="micro" color="success" style={{ marginTop: theme.spacing.xs }}>Unlocked — this content is now visible</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}

          {/* My locks */}
          <Text variant="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            You've locked · {mine.length}
          </Text>
          {mine.length === 0 ? (
            <Text variant="body" color="muted">No locks yet — create one above.</Text>
          ) : (
            mine.map((item) => {
              const revoked = item.status === 'revoked';
              return (
                <View
                  key={item.id}
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
                    <MaterialIcons name={revoked ? 'lock' : 'shield'} size={22} color={revoked ? theme.colors.textMuted : theme.colors.primary} />
                    <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                      <Text variant="bodyMedium" weight="semibold" numberOfLines={1}>{item.content}</Text>
                      <Text variant="micro" color="muted">
                        {accessLabel(item.accessMode)}
                        {item.expiresAt ? ` · expires ${relativeTime(item.expiresAt)}` : ''}
                        {revoked ? ' · revoked' : ''}
                      </Text>
                    </View>
                    {!revoked ? (
                      <Pressable onPress={() => doRevoke(item)} hitSlop={8} disabled={busyId != null} accessibilityLabel="Revoke">
                        <MaterialIcons name={busyId === item.id ? 'hourglass-empty' : 'cancel'} size={24} color={theme.colors.danger} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}

          <Text variant="micro" color="muted" style={{ marginTop: theme.spacing.md }}>
            Bond Lock lets you share protected content with a single trusted connection. Access is permission-gated and revocable.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
