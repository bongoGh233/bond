import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import {
  listINeedYouAlerts,
  getINeedYouPrefs,
  updateINeedYouPrefs,
  sendINeedYouAlert,
  acknowledgeAlert,
  subscribeToAlerts,
  type INeedYouAlert,
  type AckAction,
} from '@/src/api/iNeedYou';
import { isBackendConfigured } from '@/src/api/supabase';
import { listConnections, type ConnectionUser } from '@/src/api/connections';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { Avatar } from '@/src/components/ui/Avatar';
import { Text } from '@/src/components/ui/Text';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { BondButton } from '@/src/components/ui/Button';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function INeedYouScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';

  const [alerts, setAlerts] = useState<INeedYouAlert[]>([]);
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [optIn, setOptIn] = useState(false);

  const [recipientId, setRecipientId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const incoming = useMemo(() => alerts.filter((a) => a.forMe && a.status === 'pending'), [alerts]);
  const rest = useMemo(() => alerts.filter((a) => !(a.forMe && a.status === 'pending')), [alerts]);

  const load = useCallback(async () => {
    const [list, conns, prefs] = await Promise.all([
      listINeedYouAlerts(me),
      listConnections(me),
      getINeedYouPrefs(me),
    ]);
    setAlerts(list);
    setConnections(conns);
    setOptIn(prefs.optIn);
  }, [me]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (!isBackendConfigured) return;
    return subscribeToAlerts(me, () => {
      void load();
    });
  }, [me, load]);

  const toggleOptIn = async (value: boolean) => {
    setOptIn(value);
    await updateINeedYouPrefs(me, { optIn: value, quietHours: { enabled: false } });
  };

  const send = async () => {
    if (sending) return;
    setSending(true);
    const res = await sendINeedYouAlert(me, recipientId, message);
    setSending(false);
    if (res.ok) {
      setMessage('');
      setRecipientId('');
      await load();
    }
  };

  const ack = async (a: INeedYouAlert, action: AckAction) => {
    if (busyId) return;
    setBusyId(a.id);
    await acknowledgeAlert(me, a.id, action);
    setBusyId(null);
    setAlerts((prev) =>
      prev.map((x) =>
        x.id === a.id
          ? { ...x, status: action === 'answered' ? 'answered' : 'acknowledged', ackAction: action, ackedAt: new Date().toISOString() }
          : x
      )
    );
  };

  const recipientName = connections.find((c) => c.id === recipientId)?.displayName;

  const actionLabel: Record<AckAction, string> = { im_here: 'I\'m here', will_respond: 'Will respond', answered: 'Answered' };

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
          <ScreenHeader title="I Need You" subtitle="Permission-based urgent alerts" />
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
          {/* Incoming pending alerts */}
          {incoming.length > 0 ? (
            <View style={{ marginBottom: theme.spacing.lg }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.danger,
                  borderRadius: theme.radius.xl,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.md,
                }}
              >
                <MaterialIcons name="emergency" size={22} color="#fff" />
                <Text variant="bodyMedium" weight="semibold" color="onPrimary" style={{ marginLeft: theme.spacing.sm, flex: 1 }}>
                  {incoming.length} urgent request{incoming.length > 1 ? 's' : ''} from trusted connections
                </Text>
              </View>
              {incoming.map((a) => (
                <View
                  key={a.id}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: theme.colors.danger,
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                    <Avatar spec={{ styleId: a.requester.avatarStyle, colorId: a.requester.avatarColor, initials: a.requester.displayName }} size={44} />
                    <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                      <Text variant="bodyMedium" weight="semibold">{a.requester.displayName}</Text>
                      <Text variant="micro" color="muted">{relativeTime(a.createdAt)}</Text>
                    </View>
                    <MaterialIcons name="emergency" size={24} color={theme.colors.danger} />
                  </View>
                  <Text variant="heading" weight="semibold" style={{ marginBottom: theme.spacing.sm }}>“{a.message}”</Text>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                    {(['im_here', 'will_respond', 'answered'] as AckAction[]).map((action) => (
                      <Pressable
                        key={action}
                        onPress={() => ack(a, action)}
                        disabled={busyId != null}
                        style={({ pressed }) => ({
                          flex: 1,
                          height: 42,
                          borderRadius: theme.radius.md,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: action === 'answered' ? theme.colors.primary : theme.colors.primarySoft,
                          opacity: pressed || busyId != null ? 0.7 : 1,
                        })}
                      >
                        <Text variant="label" color={action === 'answered' ? 'onPrimary' : 'primary'} weight="semibold">
                          {busyId === a.id ? '…' : actionLabel[action]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

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
              Alert a trusted connection
            </Text>

            <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.xs }}>Who</Text>
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
                      backgroundColor: active ? theme.colors.danger : theme.colors.inputBackground,
                    }}
                  >
                    <Avatar spec={{ styleId: c.avatarStyle, colorId: c.avatarColor, initials: c.displayName }} size={20} />
                    <Text variant="micro" color={active ? 'onPrimary' : 'secondary'} weight="semibold" style={{ marginLeft: 6 }}>
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
              placeholder="Short message — e.g. I need a favour right now"
              placeholderTextColor={theme.colors.textMuted}
              value={message}
              onChangeText={setMessage}
            />

            <BondButton
              label={sending ? 'Sending…' : recipientName ? `Alert ${recipientName}` : 'Choose who to alert'}
              onPress={send}
              disabled={!recipientId || !message.trim() || !optIn}
              loading={sending}
              variant="danger"
              fullWidth
            />
            <Text variant="micro" color="muted" style={{ marginTop: theme.spacing.xs }}>
              {optIn ? 'Sends a high-priority alert; your connection chose to receive them.' : 'Enable "Receive alerts" below to send urgent alerts.'}
            </Text>
          </View>

          {/* Receive toggle */}
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: theme.spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: theme.spacing.lg,
            }}
          >
            <MaterialIcons name="campaign" size={24} color={theme.colors.primary} />
            <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
              <Text variant="bodyMedium" weight="semibold">Receive alerts</Text>
              <Text variant="caption" color="muted">Let trusted connections reach you in an emergency</Text>
            </View>
            <Switch value={optIn} onValueChange={toggleOptIn} trackColor={{ true: theme.colors.primary }} />
          </View>

          {/* History */}
          <Text variant="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm }}>
            Activity
          </Text>
          {rest.length === 0 ? (
            <EmptyState
              icon="emergency"
              title="No alert activity"
              message="Alerts you send or respond to will show up here."
              style={{ paddingVertical: theme.spacing['2xl'] }}
            />
          ) : (
            rest.map((a) => (
              <View
                key={a.id}
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
                  <Avatar spec={{ styleId: a.requester.avatarStyle, colorId: a.requester.avatarColor, initials: a.requester.displayName }} size={40} />
                  <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                    <Text variant="bodyMedium" weight="semibold" numberOfLines={1}>“{a.message}”</Text>
                    <Text variant="micro" color="muted">
                      {relativeTime(a.createdAt)} · {a.forMe ? `you responded · ${a.ackAction ? actionLabel[a.ackAction] : a.status}` : `you alerted ${a.recipient.displayName} · ${a.status}`}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
