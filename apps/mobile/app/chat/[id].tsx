import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import { isBackendConfigured } from '@/src/api/supabase';
import {
  listMessages,
  sendTextMessage,
  sendPhotoMessage,
  subscribeToMessages,
  markConversationRead,
  type ChatMessage,
  type MessageStatus,
} from '@/src/api/messages';
import { buildChatRows, formatTime, formatDayLabel, type ChatRow } from '@/src/utils/chat';
import { Avatar } from '@/src/components/ui/Avatar';
import { Text } from '@/src/components/ui/Text';

function statusMeta(status: MessageStatus, mine: boolean): { icon: 'schedule' | 'done' | 'done-all' | 'error-outline'; color: string } {
  switch (status) {
    case 'sent':
      return { icon: 'schedule', color: mine ? 'rgba(255,255,255,0.65)' : '#8B84A0' };
    case 'delivered':
      return { icon: 'done', color: mine ? 'rgba(255,255,255,0.9)' : '#8B84A0' };
    case 'read':
      return { icon: 'done-all', color: mine ? 'rgba(255,255,255,0.95)' : '#7C5CFF' };
    case 'failed':
      return { icon: 'error-outline', color: '#E5484D' };
  }
}

export default function ConversationScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    styleId?: string;
    colorId?: string;
  }>();
  const conversationId = params.id as string;
  const otherName = params.name ?? 'Chat';
  const otherStyleId = Number(params.styleId || '0') || 0;
  const otherColorId = Number(params.colorId || '0') || 0;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ChatRow>>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const msgs = await listMessages(conversationId);
      if (active) {
        setMessages(msgs);
        setLoading(false);
      }
      if (active) await markConversationRead(conversationId, me);
    })();
    const unsubscribe = subscribeToMessages(conversationId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    return () => {
      active = false;
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [conversationId, me]);

  // Auto-scroll to the newest message whenever the list grows.
  useEffect(() => {
    if (!loading && messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length, loading]);

  const rows = useMemo(() => buildChatRows(messages, me), [messages, me]);

  const applyStatus = useCallback((id: string, status: MessageStatus) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }, []);

  /**
   * In preview mode (no backend), simulate delivery -> read for a freshly sent
   * message so receipts feel alive without a real peer.
   */
  const scheduleReceipts = useCallback(
    (id: string) => {
      if (isBackendConfigured) return;
      timerRef.current = setTimeout(() => applyStatus(id, 'delivered'), 900);
      setTimeout(() => applyStatus(id, 'read'), 2400);
    },
    [applyStatus]
  );

  const sendText = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await sendTextMessage(conversationId, me, text);
    setSending(false);
    if (res.message) {
      const m: ChatMessage = res.message;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      scheduleReceipts(m.id);
      setDraft('');
      inputRef.current?.clear?.();
    }
  }, [draft, sending, conversationId, me, scheduleReceipts]);

  const pickPhoto = useCallback(async () => {
    if (sendingPhoto) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setSendingPhoto(true);
      const res = await sendPhotoMessage(conversationId, me, asset.uri);
      setSendingPhoto(false);
      if (res.message) {
        const m: ChatMessage = res.message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        scheduleReceipts(m.id);
      }
    } catch {
      setSendingPhoto(false);
    }
  }, [sendingPhoto, conversationId, me, scheduleReceipts]);

  const hasRealImage = (m: ChatMessage) =>
    m.type === 'image' && !!m.mediaMetadata?.uri && /^(https?:|file:|data:|blob:)/.test(m.mediaMetadata.uri);

  const renderGroup = useCallback(
    ({ group }: { group: Extract<ChatRow, { kind: 'group' }> }) => {
      const g = group.group;
      const isMine = g.mine;
      const showSender = !isMine;
      const first = g.messages[0];
      const last = g.messages[g.messages.length - 1];

      return (
        <View style={{ marginBottom: 2, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
          {showSender ? (
            <Text variant="micro" color="muted" style={{ marginLeft: theme.spacing.xs, marginBottom: 2 }}>
              {otherName}
            </Text>
          ) : null}
          {g.messages.map((m) => {
            const isFirstInGroup = m.id === first.id;
            const isLastInGroup = m.id === last.id;
            const isImage = hasRealImage(m);
            return (
              <View
                key={m.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                }}
              >
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isMine ? theme.colors.primary : theme.colors.surface,
                      marginBottom: isLastInGroup ? 6 : 2,
                      marginTop: isFirstInGroup ? 2 : 0,
                      borderTopLeftRadius: isMine ? theme.radius.lg : isFirstInGroup ? theme.radius.sm : theme.radius.lg,
                      borderTopRightRadius: isMine ? (isFirstInGroup ? theme.radius.sm : theme.radius.lg) : theme.radius.lg,
                      maxWidth: '78%',
                      borderWidth: isMine ? 0 : 1,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {isImage ? (
                    <Image
                      source={{ uri: m.mediaMetadata!.uri! }}
                      style={{
                        width: 200,
                        height: 160,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.inputBackground,
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text variant="body" color={isMine ? 'onPrimary' : 'text'}>{m.content}</Text>
                  )}

                  {/* Timestamp + receipt inside the bubble */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-end',
                      marginTop: 3,
                    }}
                  >
                    <Text
                      variant="micro"
                      style={{ color: isMine ? 'rgba(255,255,255,0.75)' : theme.colors.textMuted, fontSize: 10 }}
                    >
                      {formatTime(m.createdAt)}
                    </Text>
                    {isMine ? (
                      <MaterialIcons name={statusMeta(m.status, true).icon} size={14} color={statusMeta(m.status, true).color} style={{ marginLeft: 3 }} />
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      );
    },
    [theme, otherName]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatRow }) => {
      if (item.kind === 'date') {
        return (
          <View style={{ alignItems: 'center', marginVertical: theme.spacing.md }}>
            <View
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xxs,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.surfaceRaised,
              }}
            >
              <Text variant="micro" color="muted">{item.label}</Text>
            </View>
          </View>
        );
      }
      return renderGroup({ group: item });
    },
    [theme, renderGroup]
  );

  const headerBack = (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
      <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header */}
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
        {headerBack}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: theme.spacing.sm }}>
          <Avatar spec={{ styleId: otherStyleId, colorId: otherColorId, initials: otherName }} size={36} />
          <Text variant="subheading" weight="semibold" numberOfLines={1} style={{ marginLeft: theme.spacing.sm, flexShrink: 1 }}>
            {otherName}
          </Text>
        </View>
        <MaterialIcons name="more-vert" size={24} color={theme.colors.textMuted} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(r) => (r.kind === 'date' ? `date-${r.at}` : `group-${r.group.messages[0].id}`)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md }}
          ListEmptyComponent={
            <View style={{ paddingVertical: theme.spacing['3xl'] }}>
              <Text variant="body" color="secondary" align="center">Say hi 👋</Text>
            </View>
          }
        />
      )}

      {/* Composer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.xs,
            paddingBottom: insets.bottom + theme.spacing.sm,
          }}
        >
          <Pressable
            onPress={pickPhoto}
            disabled={sendingPhoto}
            hitSlop={8}
            accessibilityLabel="Send photo"
            style={({ pressed }) => ({ opacity: pressed || sendingPhoto ? 0.7 : 1 })}
          >
            <MaterialIcons name={sendingPhoto ? 'hourglass-empty' : 'add-photo-alternate'} size={26} color={theme.colors.primary} />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={{
              flex: 1,
              marginHorizontal: theme.spacing.sm,
              backgroundColor: theme.colors.inputBackground,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              color: theme.colors.text,
              fontSize: theme.typography.sizes.md,
              maxHeight: 120,
            }}
            placeholder="Message"
            placeholderTextColor={theme.colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            onSubmitEditing={sendText}
          />
          <Pressable
            onPress={sendText}
            disabled={sending || !draft.trim()}
            accessibilityLabel="Send message"
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary,
                opacity: pressed || sending || !draft.trim() ? 0.5 : 1,
              },
            ]}
          >
            <MaterialIcons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
