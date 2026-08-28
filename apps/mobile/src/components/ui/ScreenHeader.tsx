import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/src/providers/theme-provider';
import { Text } from './Text';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ eyebrow, title, subtitle, right }: ScreenHeaderProps) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
      }}
    >
      <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
        {eyebrow ? (
          <Text variant="micro" color="primary" style={{ textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: theme.spacing.xxs }}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="heading" weight="bold">{title}</Text>
        {subtitle ? <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}
