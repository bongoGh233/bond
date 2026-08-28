import React from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '@/src/providers/theme-provider';
import { Avatar, type AvatarSpec } from './Avatar';
import { Text } from './Text';

export type ConnectionAction =
  | { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean }
  | null;

interface ConnectionCardProps {
  user: AvatarSpec & { displayName: string; bondId?: string; bio?: string };
  actions?: ConnectionAction[];
  onPress?: () => void;
}

/**
 * A reusable row that shows a person's avatar, name, Bond ID and bio, with
 * optional action buttons (used in Connections list, requests and search).
 */
export function ConnectionCard({ user, actions = [], onPress }: ConnectionCardProps) {
  const { theme } = useTheme();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
      }}
    >
      <Avatar spec={{ styleId: user.styleId, colorId: user.colorId, initials: user.initials || user.displayName }} size={56} />
      <View style={{ flex: 1, marginLeft: theme.spacing.md, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="bodyMedium" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {user.displayName}
          </Text>
          {user.bondId ? (
            <Text variant="caption" color="primary" numberOfLines={1} style={{ marginLeft: theme.spacing.xs }}>
              @{user.bondId}
            </Text>
          ) : null}
        </View>
        {user.bio ? (
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {user.bio}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        marginBottom: theme.spacing.sm,
      }}
    >
      {onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}>
          {content}
        </Pressable>
      ) : (
        content
      )}
      {actions.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, paddingBottom: theme.spacing.sm }}>
          {actions.map((a, idx) =>
            a ? (
              <Pressable
                key={idx}
                onPress={a.onPress}
                disabled={a.loading}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 42,
                  borderRadius: theme.radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    a.variant === 'danger'
                      ? theme.colors.dangerSoft
                      : a.variant === 'secondary'
                        ? theme.colors.inputBackground
                        : theme.colors.primarySoft,
                  opacity: pressed || a.loading ? 0.7 : 1,
                })}
              >
                <Text
                  variant="label"
                  weight="semibold"
                  color={a.variant === 'danger' ? 'danger' : 'primary'}
                >
                  {a.loading ? '…' : a.label}
                </Text>
              </Pressable>
            ) : null
          )}
        </View>
      ) : null}
    </View>
  );
}
