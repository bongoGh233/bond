import React, { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { useTheme } from '@/src/providers/theme-provider';
import { Screen } from '@/src/components/ui/Screen';
import { Text } from '@/src/components/ui/Text';
import { BondInput } from '@/src/components/ui/Input';
import { BondButton } from '@/src/components/ui/Button';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!email.trim()) return;
    setSent(true);
    // TODO(Phase 2): wire to Supabase password reset email.
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <Text variant="heading" weight="semibold">Reset password</Text>
          <Text variant="body" color="secondary">Enter your email and we'll send a reset link.</Text>
        </View>

        {sent ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="body" color="success">Check your inbox — we've sent a reset link.</Text>
            <Link href="/(auth)/login" asChild>
              <BondButton label="Back to log in" variant="secondary" fullWidth />
            </Link>
          </View>
        ) : (
          <>
            <BondInput
              label="Email"
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <BondButton label="Send reset link" onPress={handleSend} fullWidth size="lg" />
            <Link href="/(auth)/login" style={{ alignSelf: 'center' }}>
              <Text variant="label" color="muted">Back to log in</Text>
            </Link>
          </>
        )}
      </View>
    </Screen>
  );
}
