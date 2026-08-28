import React from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/providers/theme-provider';
import { Screen } from '@/src/components/ui/Screen';
import { Text } from '@/src/components/ui/Text';
import { BondButton } from '@/src/components/ui/Button';
import { BrandMark } from '@/src/components/BrandMark';

export default function WelcomeScreen() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={
          theme.mode === 'dark'
            ? ['#1B1350', '#120D28', theme.colors.background]
            : ['#EFEaff', '#F6F3FF', theme.colors.background]
        }
        style={{ flex: 1 }}
      >
        <Screen scroll padded={false}>
          <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: theme.spacing.xl, minHeight: '100%' }}>
            <View style={{ alignItems: 'center', marginTop: theme.spacing['4xl'] }}>
              <BrandMark size={88} showWordmark={false} />
            </View>

            <View style={{ alignItems: 'center', paddingHorizontal: theme.spacing.xl }}>
              <Text variant="display" weight="heavy" align="center">
                Stay close to the
              </Text>
              <Text variant="display" weight="heavy" color="primary" align="center">
                people who matter
              </Text>
              <View style={{ height: theme.spacing.lg }} />
              <Text variant="body" color="secondary" align="center" style={{ maxWidth: 320 }}>
                A private space for the people you trust. Communicate, share moments,
                and feel connected — your way.
              </Text>
            </View>

            <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm }}>
              <Link href="/(auth)/login" asChild>
                <BondButton label="Log in" variant="primary" size="lg" fullWidth />
              </Link>
              <Link href="/(auth)/signup" asChild>
                <BondButton label="Create your Bond ID" variant="secondary" size="lg" fullWidth />
              </Link>
              <Text variant="micro" color="muted" align="center" style={{ marginTop: theme.spacing.sm }}>
                By continuing you agree to bond's terms & privacy policy.
              </Text>
            </View>
          </View>
        </Screen>
      </LinearGradient>
    </View>
  );
}
