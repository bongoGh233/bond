import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/src/providers/theme-provider';
import { Text } from './Text';

interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  message?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, message, action, style }: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing['3xl'] }, style]}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: theme.radius['2xl'],
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.md,
        }}
      >
        <MaterialIcons name={icon} size={34} color={theme.colors.primary} />
      </View>
      <Text variant="heading" weight="semibold" align="center">{title}</Text>
      {message ? (
        <Text variant="body" color="secondary" align="center" style={{ marginTop: theme.spacing.xs, maxWidth: 320 }}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: theme.spacing.lg }}>{action}</View> : null}
    </View>
  );
}
