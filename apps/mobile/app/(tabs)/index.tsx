import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import { listConversations, type ConversationSummary } from '@/src/api/messages';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Avatar } from '@/src/components/ui/Avatar';
import { Text } from '@/src/components/ui/Text';

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await listConversations(me);
    setConversations(list);
  }, [me]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openChat = (c: ConversationSummary) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: c.id,
        name: c.other.displayName,
        styleId: String(c.other.avatarStyle ?? 0),
        colorId: String(c.other.avatarColor ?? 0),
      },
    } as Href);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.layout.screenPadding, paddingBottom: insets.bottom + theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ScreenHeader eyebrow="Bond" title="Chats" />

        {loading ? (
          <Text variant="body" color="secondary" align="center" style={{ marginTop: theme.spacing['3xl'] }}>
            Loading…
          </Text>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon="chat-bubble-outline"
            title="No conversations yet"
            message="Your private conversations with trusted connections will appear here. Start one from your Connections list."
          />
        ) : (
          conversations.map((c) => {
            const initials = c.other.displayName;
            const isImageLast = c.lastMessageType === 'image';
            return (
              <Pressable
                key={c.id}
                onPress={() => openChat(c)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: theme.spacing.md,
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  paddingHorizontal: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Avatar spec={{ styleId: c.other.avatarStyle, colorId: c.other.avatarColor, initials }} size={52} showBorder />
                <View style={{ flex: 1, marginLeft: theme.spacing.md, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text variant="bodyMedium" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {c.other.displayName}
                    </Text>
                    <Text variant="micro" color="muted" style={{ marginLeft: theme.spacing.xs }}>
                      {formatTime(c.lastMessageAt)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text
                      variant="caption"
                      color={c.unread ? 'text' : 'secondary'}
                      weight={c.unread ? 'semibold' : 'regular'}
                      numberOfLines={1}
                      style={{ flexShrink: 1 }}
                    >
                      {isImageLast ? '📷 Photo' : c.lastMessage}
                    </Text>
                    {c.unread ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: theme.colors.primary,
                          marginLeft: theme.spacing.xs,
                        }}
                      />
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
