import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { Text } from '@/src/components/ui/Text';
import { Screen } from '@/src/components/ui/Screen';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { BondButton } from '@/src/components/ui/Button';

interface PlaceholderProps {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  phase: string;
  description: string;
  backHref?: string;
}

export function PlaceholderScreen({ title, icon, phase, description, backHref = '/(tabs)/settings' }: PlaceholderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm }}>
          <MaterialIcons name="arrow-back-ios" size={22} color={theme.colors.text} onPress={() => router.back()} />
          <Text variant="heading" weight="bold" style={{ marginLeft: theme.spacing.sm }}>{title}</Text>
        </View>
      </View>
      <EmptyState
        icon={icon}
        title={`${title} — coming soon`}
        message={description}
        action={
          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ alignSelf: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.colors.warningSoft, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs }}>
              <Text variant="micro" color="warning">{phase}</Text>
            </View>
            <BondButton label="Go back" variant="secondary" onPress={() => router.back()} />
          </View>
        }
      />
    </Screen>
  );
}
