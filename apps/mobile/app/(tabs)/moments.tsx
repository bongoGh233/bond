import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import {
  listFeedMoments,
  createTextMoment,
  createPhotoMoment,
  viewMoment,
  deleteMoment,
  type Moment,
  type MomentDuration,
} from '@/src/api/moments';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { Avatar } from '@/src/components/ui/Avatar';
import { Text } from '@/src/components/ui/Text';
import { EmptyState } from '@/src/components/ui/EmptyState';

const DURATIONS: { value: MomentDuration; label: string }[] = [
  { value: 'short', label: '12m' },
  { value: 'hour', label: '1h' },
  { value: 'day', label: '24h' },
  { value: 'permanent', label: 'Keep' },
];

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

function hasRealImage(m: Moment): boolean {
  return m.type === 'image' && !!m.mediaMetadata?.uri && /^(https?:|file:|data:|blob:)/.test(m.mediaMetadata.uri);
}

export default function MomentsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [caption, setCaption] = useState('');
  const [duration, setDuration] = useState<MomentDuration>('hour');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    const list = await listFeedMoments(me);
    setMoments(list);
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

  const myMoments = moments.filter((m) => m.mine);
  const feed = moments.filter((m) => !m.mine);

  const pickPhoto = async () => {
    if (picking) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      setPicking(false);
    } finally {
      setPicking(false);
    }
  };

  const post = async () => {
    if (posting || (!caption.trim() && !photoUri)) return;
    setPosting(true);
    let res;
    if (photoUri) {
      res = await createPhotoMoment(me, photoUri, caption, duration);
    } else {
      res = await createTextMoment(me, caption, duration);
    }
    setPosting(false);
    if (res.ok) {
      setCaption('');
      setPhotoUri(null);
      await load();
    }
  };

  const markViewed = async (m: Moment) => {
    if (m.mine) return;
    await viewMoment(me, m.id);
    setMoments((prev) => prev.map((x) => (x.id === m.id ? { ...x, viewerIds: x.viewerIds.includes(me) ? x.viewerIds : [...x.viewerIds, me], viewCount: x.viewerIds.includes(me) ? x.viewCount : x.viewCount + 1 } : x)));
  };

  const removeMoment = async (m: Moment) => {
    await deleteMoment(me, m.id);
    setMoments((prev) => prev.filter((x) => x.id !== m.id));
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.layout.screenPadding, paddingBottom: insets.bottom + theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ScreenHeader eyebrow="Share" title="Moments" />

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
            New moment
          </Text>
          {photoUri ? (
            <View style={{ marginBottom: theme.spacing.sm }}>
              <Image source={{ uri: photoUri }} style={{ width: '100%', height: 160, borderRadius: theme.radius.md }} resizeMode="cover" />
              <Pressable onPress={() => setPhotoUri(null)} hitSlop={8} style={{ position: 'absolute', top: 8, right: 8 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 14 }}>✕</Text>
                </View>
              </Pressable>
            </View>
          ) : null}
          <TextInput
            style={{
              backgroundColor: theme.colors.inputBackground,
              borderRadius: theme.radius.lg,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              color: theme.colors.text,
              fontSize: theme.typography.sizes.md,
              minHeight: 44,
            }}
            placeholder="What's happening?"
            placeholderTextColor={theme.colors.textMuted}
            value={caption}
            onChangeText={setCaption}
            multiline
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
            {DURATIONS.map((d) => {
              const active = d.value === duration;
              return (
                <Pressable
                  key={d.value}
                  onPress={() => setDuration(d.value)}
                  style={{
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.xxs,
                    borderRadius: theme.radius.pill,
                    backgroundColor: active ? theme.colors.primarySoft : theme.colors.inputBackground,
                  }}
                >
                  <Text variant="micro" color={active ? 'primary' : 'secondary'} weight="semibold">
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
            <Pressable
              onPress={pickPhoto}
              disabled={picking}
              style={({ pressed }) => ({
                flex: 1,
                height: 42,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primarySoft,
                opacity: pressed || picking ? 0.7 : 1,
              })}
            >
              <Text variant="label" color="primary" weight="semibold">Attach photo</Text>
            </Pressable>
            <Pressable
              onPress={post}
              disabled={posting || (!caption.trim() && !photoUri)}
              style={({ pressed }) => ({
                flex: 1,
                height: 42,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary,
                opacity: pressed || posting || (!caption.trim() && !photoUri) ? 0.6 : 1,
              })}
            >
              <Text variant="label" color="onPrimary" weight="semibold">{posting ? 'Posting…' : 'Post'}</Text>
            </Pressable>
          </View>
        </View>

        {/* My moments strip */}
        {myMoments.length > 0 ? (
          <View style={{ marginBottom: theme.spacing.md }}>
            <Text variant="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm }}>
              Your moments
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
              {myMoments.map((m) => (
                <Pressable key={m.id} onPress={() => removeMoment(m)}>
                  <View
                    style={{
                      width: 92,
                      height: 120,
                      borderRadius: theme.radius.lg,
                      backgroundColor: theme.colors.surface,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: theme.spacing.xs,
                    }}
                  >
                    {hasRealImage(m) ? (
                      <Image source={{ uri: m.mediaMetadata!.uri! }} style={{ width: '100%', height: '70%', borderRadius: theme.radius.md }} resizeMode="cover" />
                    ) : (
                      <Text variant="label" color="secondary" numberOfLines={2} style={{ textAlign: 'center' }}>
                        {m.caption}
                      </Text>
                    )}
                    <Text variant="micro" color="muted" style={{ marginTop: 4 }}>
                      {m.viewCount} view{m.viewCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Feed */}
        <Text variant="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm }}>
          From connections
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing['3xl'], alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : feed.length === 0 ? (
          <EmptyState
            icon="auto-awesome"
            title="No moments to show"
            message="Moments from your trusted connections will appear here in real time."
          />
        ) : (
          feed.map((m) => {
            const seen = m.viewerIds.includes(me);
            return (
              <Pressable
                key={m.id}
                onPress={() => markViewed(m)}
                style={({ pressed }) => ({
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: seen ? theme.colors.border : theme.colors.primarySoft,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                  <Avatar spec={{ styleId: m.author?.avatarStyle ?? 0, colorId: m.author?.avatarColor ?? 0, initials: m.author?.displayName ?? '?' }} size={40} />
                  <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                    <Text variant="bodyMedium" weight="semibold">{m.author?.displayName ?? 'Someone'}</Text>
                    <Text variant="micro" color="muted">
                      {relativeTime(m.createdAt)} · {seen ? 'Seen' : `${m.viewCount} seen`}
                    </Text>
                  </View>
                  {!seen ? (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary }} />
                  ) : (
                    <Text variant="micro" color="muted">{m.viewerIds.length}</Text>
                  )}
                </View>
                {hasRealImage(m) ? (
                  <Image source={{ uri: m.mediaMetadata!.uri! }} style={{ width: '100%', height: 220, borderRadius: theme.radius.lg, marginBottom: theme.spacing.sm }} resizeMode="cover" />
                ) : null}
                {m.caption ? (
                  <Text variant="body" color="secondary" style={{ marginTop: hasRealImage(m) ? 0 : theme.spacing.xxs }}>
                    {m.caption}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
