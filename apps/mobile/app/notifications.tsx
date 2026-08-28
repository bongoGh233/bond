import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/src/api/notifications';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { Text } from '@/src/components/ui/Text';
import { EmptyState } from '@/src/components/ui/EmptyState';

function iconFor(type: AppNotification['type']): keyof typeof MaterialIcons.glyphMap {
  switch (type) {
    case 'message': return 'chat-bubble-outline';
    case 'connection': return 'person-add';
    case 'moment': return 'auto-awesome';
    case 'shared': return 'photo-album';
    case 'bond_lock': return 'lock-outline';
    case 'surprise': return 'redeem';
    case 'i_need_you': return 'emergency';
    default: return 'notifications-none';
  }
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

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const list = await listNotifications(me);
    setItems(list);
  }, [me]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const unread = items.filter((n) => !n.read).length;

  const open = async (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await markNotificationRead(me, n.id);
    }
  };

  const markAll = async () => {
    if (unread === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    await markAllNotificationsRead(me);
  };

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
          <ScreenHeader title="Notifications" subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up'} />
        </View>
        {unread > 0 ? (
          <Pressable onPress={markAll} hitSlop={8} accessibilityLabel="Mark all as read">
            <Text variant="caption" color="primary" weight="semibold">Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={{ paddingVertical: theme.spacing['3xl'], alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="notifications-none"
          title="No notifications"
          message="Messages, moments, surprises and alerts from your trusted connections will show up here."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.layout.screenPadding,
            paddingBottom: insets.bottom + theme.spacing['3xl'],
            paddingTop: theme.spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
        >
          {items.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <Pressable
                key={n.id}
                onPress={() => open(n)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: n.read ? theme.colors.border : theme.colors.primarySoft,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.lg,
                    backgroundColor: n.read ? theme.colors.primarySoft : theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name={Icon} size={20} color={n.read ? theme.colors.primary : theme.colors.onPrimary} />
                </View>
                <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                  <Text variant="bodyMedium" weight={n.read ? 'regular' : 'semibold'} numberOfLines={1}>{n.title}</Text>
                  <Text variant="caption" color="secondary" numberOfLines={2}>{n.body}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: theme.spacing.sm }}>
                  <Text variant="micro" color="muted">{relativeTime(n.createdAt)}</Text>
                  {!n.read ? (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 6 }} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}