import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import {
  listConnections,
  listRequests,
  searchBondId,
  sendRequest,
  respondRequest,
  removeConnection,
  type ConnectionUser,
  type ConnectionRequest,
  type OutgoingRequest,
} from '@/src/api/connections';
import { getOrCreateConversation } from '@/src/api/messages';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { ConnectionCard } from '@/src/components/ui/ConnectionCard';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { BondInput } from '@/src/components/ui/Input';
import { Text } from '@/src/components/ui/Text';

type Segment = 'connections' | 'requests' | 'add';

export default function ConnectionsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const me = session?.userId ?? 'you';

  const [segment, setSegment] = useState<Segment>('connections');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [incoming, setIncoming] = useState<ConnectionRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ConnectionUser[]>([]);
  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([listConnections(me), listRequests(me)]);
    setConnections(c);
    setIncoming(r.incoming);
    setOutgoing(r.outgoing);
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

  useEffect(() => {
    if (segment !== 'add') return;
    const t = setTimeout(async () => {
      const res = await searchBondId(me, searchQuery);
      setSearchResults(res.filter((u) => !pendingAdds.has(u.id)));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, segment, me]);

  const handleAdd = async (user: ConnectionUser) => {
    setPendingAdds((s) => new Set(s).add(user.id));
    await sendRequest(me, user.id);
    setSearchResults((prev) => prev.filter((u) => u.id !== user.id));
    await load();
  };

  const handleRespond = async (req: ConnectionRequest, accept: boolean) => {
    await respondRequest(me, req.id, accept ? 'accept' : 'decline');
    await load();
  };

  const handleRemove = async (user: ConnectionUser) => {
    await removeConnection(me, user.id);
    await load();
  };

  const handleMessage = async (user: ConnectionUser) => {
    const res = await getOrCreateConversation(me, user.id);
    if (!('id' in res)) return;
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: res.id,
        name: user.displayName,
        styleId: String(user.avatarStyle ?? 0),
        colorId: String(user.avatarColor ?? 0),
      },
    } as Href);
  };

  const requestsBadge = incoming.length;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.layout.screenPadding, paddingBottom: insets.bottom + theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ScreenHeader eyebrow="Network" title="Connections" right={undefined} />

        <SegmentedControl<Segment>
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'connections', label: 'Connections', badge: connections.length },
            { value: 'requests', label: 'Requests', badge: requestsBadge },
            { value: 'add', label: 'Add' },
          ]}
        />

        <View style={{ height: theme.spacing.lg }} />

        {loading ? (
          <Text variant="body" color="secondary" align="center">Loading…</Text>
        ) : segment === 'connections' ? (
          connections.length === 0 ? (
            <EmptyState
              icon="diversity-1"
              title="No connections yet"
              message="Bond is built around people you mutually trust. Use Add to send a request to a friend, family member, or partner."
            />
          ) : (
            connections.map((u) => (
              <ConnectionCard
                key={u.id}
                user={{ styleId: u.avatarStyle, colorId: u.avatarColor, initials: u.displayName, displayName: u.displayName, bondId: u.bondId, bio: u.bio }}
                actions={[{ label: 'Message', onPress: () => handleMessage(u) }, { label: 'Remove', variant: 'danger', onPress: () => handleRemove(u) }]}
              />
            ))
          )
        ) : segment === 'requests' ? (
          <>
            {incoming.length > 0 || outgoing.length > 0 ? (
              <>
                {incoming.length > 0 ? (
                  <>
                    <Text variant="label" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
                      Incoming
                    </Text>
                    {incoming.map((req) => (
                      <ConnectionCard
                        key={req.id}
                        user={{ styleId: req.user.avatarStyle, colorId: req.user.avatarColor, initials: req.user.displayName, displayName: req.user.displayName, bondId: req.user.bondId, bio: req.user.bio }}
                        actions={[
                          { label: 'Decline', variant: 'danger', onPress: () => handleRespond(req, false) },
                          { label: 'Accept', onPress: () => handleRespond(req, true) },
                        ]}
                      />
                    ))}
                  </>
                ) : null}
                {outgoing.length > 0 ? (
                  <>
                    <Text variant="label" color="secondary" style={{ marginVertical: theme.spacing.sm }}>
                      Outgoing
                    </Text>
                    {outgoing.map((req) => (
                      <ConnectionCard
                        key={req.id}
                        user={{ styleId: req.user.avatarStyle, colorId: req.user.avatarColor, initials: req.user.displayName, displayName: req.user.displayName, bondId: req.user.bondId, bio: req.user.bio }}
                        actions={[{ label: 'Cancel request', variant: 'secondary', onPress: () => handleRespond({ ...req, direction: 'outgoing' }, false) }]}
                      />
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon="notifications-none"
                title="No requests"
                message="Incoming and outgoing connection requests will appear here."
              />
            )}
          </>
        ) : (
          <>
            <BondInput
              icon="search"
              placeholder="Search by Bond ID or name"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            <View style={{ height: theme.spacing.md }} />
            {!searchQuery.trim() ? (
              <EmptyState
                icon="person-search"
                title="Find someone"
                message="Enter a Bond ID or display name to find a trusted person to connect with."
              />
            ) : searchResults.length === 0 ? (
              <EmptyState
                icon="person-off"
                title="No matches"
                message="We couldn't find anyone matching that. They may already be a connection."
              />
            ) : (
              searchResults.map((u) => (
                <ConnectionCard
                  key={u.id}
                  user={{ styleId: u.avatarStyle, colorId: u.avatarColor, initials: u.displayName, displayName: u.displayName, bondId: u.bondId, bio: u.bio }}
                  actions={[{ label: 'Add', onPress: () => handleAdd(u) }]}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
