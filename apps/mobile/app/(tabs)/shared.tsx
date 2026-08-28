import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import {
  listSpaces,
  listMemories,
  addMemory,
  listBucketItems,
  addBucketItem,
  toggleBucketItem,
  createSpace,
  type SharedSpace,
  type Memory,
  type BucketItem,
} from '@/src/api/shared';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { Avatar } from '@/src/components/ui/Avatar';
import { Text } from '@/src/components/ui/Text';
import { EmptyState } from '@/src/components/ui/EmptyState';

type Segment = 'overview' | 'memories' | 'bucket';

export default function SharedScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';

  const [segment, setSegment] = useState<Segment>('overview');
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const space = spaces[0];

  const load = useCallback(async () => {
    const sp = await listSpaces(me);
    setSpaces(sp);
    const sid = sp[0]?.id;
    if (sid) {
      const [mem, bk] = await Promise.all([listMemories(sid), listBucketItems(sid)]);
      setMemories(mem);
      setBucket(bk);
    }
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

  // Memory composer state
  const [memNote, setMemNote] = useState('');
  const [memMilestone, setMemMilestone] = useState(false);
  const [postingMem, setPostingMem] = useState(false);

  // Bucket composer state
  const [bkTitle, setBkTitle] = useState('');
  const [bkNote, setBkNote] = useState('');
  const [postingBk, setPostingBk] = useState(false);

  const postMemory = async () => {
    if (postingMem || !space) return;
    setPostingMem(true);
    const res = await addMemory(space.id, me, memNote, memMilestone);
    setPostingMem(false);
    if (res.ok) {
      setMemNote('');
      setMemMilestone(false);
      setMemories(await listMemories(space.id));
    }
  };

  const postBucket = async () => {
    if (postingBk || !space) return;
    setPostingBk(true);
    const res = await addBucketItem(space.id, me, bkTitle, bkNote);
    setPostingBk(false);
    if (res.ok) {
      setBkTitle('');
      setBkNote('');
      setBucket(await listBucketItems(space.id));
    }
  };

  const toggle = async (item: BucketItem) => {
    if (!space) return;
    await toggleBucketItem(space.id, item.id, me, !item.done);
    setBucket(await listBucketItems(space.id));
  };

  const createFirstSpace = async () => {
    const res = await createSpace(me, 'Our Space', []);
    if (res.ok) await load();
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.layout.screenPadding, paddingBottom: insets.bottom + theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ScreenHeader eyebrow="Together" title="Shared Space" />

        {loading ? (
          <View style={{ paddingVertical: theme.spacing['3xl'], alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : !space ? (
          <EmptyState
            icon="auto-stories"
            title="No shared space yet"
            message="Create a private space for shared timelines, memories, and things to do together."
            action={
              <Pressable onPress={createFirstSpace} style={{ backgroundColor: theme.colors.primary, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill }}>
                <Text variant="label" color="onPrimary" weight="semibold">Create space</Text>
              </Pressable>
            }
          />
        ) : (
          <>
            {/* Space header */}
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.md,
              }}
            >
              <Text variant="heading" weight="bold">{space.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
                {space.members.map((m) => (
                  <Avatar key={m.id} spec={{ styleId: m.avatarStyle, colorId: m.avatarColor, initials: m.displayName }} size={28} showBorder />
                ))}
                <Text variant="caption" color="secondary" style={{ marginLeft: theme.spacing.xs }}>
                  {space.memberCount} member{space.memberCount === 1 ? '' : 's'}
                </Text>
              </View>
            </View>

            <SegmentedControl<Segment>
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'overview', label: 'Overview' },
                { value: 'memories', label: 'Memories', badge: memories.length },
                { value: 'bucket', label: 'Bucket', badge: bucket.length },
              ]}
            />
            <View style={{ height: theme.spacing.lg }} />

            {segment === 'overview' ? (
              <Overview
                memories={memories}
                bucket={bucket}
                onView={() => setSegment('memories')}
                onBucket={() => setSegment('bucket')}
              />
            ) : segment === 'memories' ? (
              <View>
                {/* Add memory composer */}
                <View style={composerStyle(theme).box}>
                  <Text variant="label" weight="semibold" style={{ marginBottom: theme.spacing.sm }}>Add a memory</Text>
                  <TextInput
                    style={composerStyle(theme).input}
                    placeholder="Remember when…"
                    placeholderTextColor={theme.colors.textMuted}
                    value={memNote}
                    onChangeText={setMemNote}
                    multiline
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: theme.spacing.sm }}>
                    <Pressable onPress={() => setMemMilestone((v) => !v)} hitSlop={8}>
                      <Text variant="caption" color={memMilestone ? 'primary' : 'secondary'} weight="semibold">
                        {memMilestone ? '★ Milestone' : 'Mark as milestone'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={postMemory}
                      disabled={postingMem || !memNote.trim()}
                      style={{
                        backgroundColor: theme.colors.primary,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.xs,
                        borderRadius: theme.radius.pill,
                        opacity: postingMem || !memNote.trim() ? 0.5 : 1,
                      }}
                    >
                      <Text variant="label" color="onPrimary" weight="semibold">{postingMem ? 'Saving…' : 'Add'}</Text>
                    </Pressable>
                  </View>
                </View>

                {memories.length === 0 ? (
                  <EmptyState icon="collections-bookmark" title="No memories yet" message="Add the first memory to your shared timeline." />
                ) : (
                  memories.map((m) => (
                    <View
                      key={m.id}
                      style={{
                        backgroundColor: theme.colors.surface,
                        borderRadius: theme.radius.xl,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        padding: theme.spacing.md,
                        marginBottom: theme.spacing.sm,
                        borderLeftWidth: m.milestone ? 3 : 1,
                        borderLeftColor: theme.colors.gold,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs }}>
                        <Avatar spec={{ styleId: m.author?.avatarStyle ?? 0, colorId: m.author?.avatarColor ?? 0, initials: m.author?.displayName ?? '?' }} size={32} />
                        <View style={{ marginLeft: theme.spacing.sm }}>
                          <Text variant="caption" weight="semibold">
                            {m.author?.displayName ?? 'Someone'}
                            {m.milestone ? <Text variant="caption" color="warning"> ★</Text> : null}
                          </Text>
                          <Text variant="micro" color="muted">{new Date(m.createdAt).toLocaleDateString()}</Text>
                        </View>
                      </View>
                      <Text variant="body" color="secondary">{m.note}</Text>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <View>
                <View style={composerStyle(theme).box}>
                  <Text variant="label" weight="semibold" style={{ marginBottom: theme.spacing.sm }}>Add to bucket list</Text>
                  <TextInput
                    style={composerStyle(theme).input}
                    placeholder="Something to do together"
                    placeholderTextColor={theme.colors.textMuted}
                    value={bkTitle}
                    onChangeText={setBkTitle}
                  />
                  <TextInput
                    style={composerStyle(theme).input}
                    placeholder="Note (optional)"
                    placeholderTextColor={theme.colors.textMuted}
                    value={bkNote}
                    onChangeText={setBkNote}
                  />
                  <Pressable
                    onPress={postBucket}
                    disabled={postingBk || !bkTitle.trim()}
                    style={{
                      alignSelf: 'flex-end',
                      backgroundColor: theme.colors.primary,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.xs,
                      borderRadius: theme.radius.pill,
                      marginTop: theme.spacing.sm,
                      opacity: postingBk || !bkTitle.trim() ? 0.5 : 1,
                    }}
                  >
                    <Text variant="label" color="onPrimary" weight="semibold">{postingBk ? 'Saving…' : 'Add'}</Text>
                  </Pressable>
                </View>

                {bucket.length === 0 ? (
                  <EmptyState icon="checklist" title="Empty bucket list" message="Add adventures you want to do together." />
                ) : (
                  bucket.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => toggle(item)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: theme.colors.surface,
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        padding: theme.spacing.md,
                        marginBottom: theme.spacing.sm,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: item.done ? theme.colors.success : theme.colors.border,
                          backgroundColor: item.done ? theme.colors.success : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: theme.spacing.sm,
                        }}
                      >
                        {item.done ? <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body" weight={item.done ? 'regular' : 'semibold'} style={item.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : null}>
                          {item.title}
                        </Text>
                        {item.note ? <Text variant="caption" color="secondary">{item.note}</Text> : null}
                        {item.done && item.doneBy ? (
                          <Text variant="micro" color="success">Done by {item.doneBy === 'you' ? 'you' : 'a friend'}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Overview({ memories, bucket, onView, onBucket }: { memories: Memory[]; bucket: BucketItem[]; onView: () => void; onBucket: () => void }) {
  const { theme } = useTheme();
  const milestones = memories.filter((m) => m.milestone);
  const open = bucket.filter((b) => !b.done).length;
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Pressable onPress={onView} style={summaryStyle(theme).card}>
        <Text variant="heading" weight="semibold">Memories</Text>
        <Text variant="body" color="secondary">{memories.length} captured · {milestones.length} milestone</Text>
      </Pressable>
      <Pressable onPress={onBucket} style={summaryStyle(theme).card}>
        <Text variant="heading" weight="semibold">Bucket list</Text>
        <Text variant="body" color="secondary">{open} to do · {bucket.length - open} done</Text>
      </Pressable>
    </View>
  );
}

function composerStyle(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    box: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    input: {
      backgroundColor: theme.colors.inputBackground,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.text,
      fontSize: theme.typography.sizes.md,
      marginBottom: theme.spacing.sm,
    },
  };
}

function summaryStyle(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
  };
}
