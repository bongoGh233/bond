import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/src/providers/theme-provider';
import { Text } from './Text';
import { Card } from './Card';

interface SettingsRowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  destructive?: boolean;
}

export function SettingsRow({ icon, iconColor, label, value, onPress, last, destructive }: SettingsRowProps) {
  const { theme } = useTheme();
  const Row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radius.md,
          backgroundColor: iconColor ? `${iconColor}1A` : theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: theme.spacing.sm,
        }}
      >
        <MaterialIcons name={icon} size={20} color={iconColor ?? theme.colors.primary} />
      </View>
      <Text variant="bodyMedium" color={destructive ? 'danger' : 'text'} style={{ flex: 1 }}>
        {label}
      </Text>
      {value ? <Text variant="caption" color="muted" style={{ marginRight: theme.spacing.xxs }}>{value}</Text> : null}
      <MaterialIcons name="chevron-right" size={22} color={theme.colors.textMuted} />
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}>{Row}</Pressable>
  ) : (
    Row
  );
}

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function SettingsGroup({ title, children, style }: SettingsGroupProps) {
  const { theme } = useTheme();
  return (
    <View style={[{ marginBottom: theme.spacing.lg }, style]}>
      <Text variant="micro" color="muted" style={{ textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: theme.spacing.xs, marginLeft: theme.spacing.xs }}>
        {title}
      </Text>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {children}
      </Card>
    </View>
  );
}
