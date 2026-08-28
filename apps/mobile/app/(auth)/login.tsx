import React, { useState } from 'react';
import { View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import { signIn as apiSignIn } from '@/src/api/auth';
import { Screen } from '@/src/components/ui/Screen';
import { Text } from '@/src/components/ui/Text';
import { BondInput } from '@/src/components/ui/Input';
import { BondButton } from '@/src/components/ui/Button';
import { BrandMark } from '@/src/components/BrandMark';

export default function LoginScreen() {
  const { theme } = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const result = await apiSignIn({ email: email.trim(), password });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await signIn(result.session);
    router.replace('/(tabs)');
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
          <BrandMark size={64} />
          <View style={{ height: theme.spacing.md }} />
          <Text variant="heading" weight="semibold">Welcome back</Text>
          <Text variant="body" color="secondary">Log in to your Bond space</Text>
        </View>

        <BondInput
          label="Email"
          icon="mail-outline"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <BondInput
          label="Password"
          icon="lock-outline"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text variant="caption" color="danger">{error}</Text> : null}

        <Link href="/(auth)/forgot" style={{ alignSelf: 'flex-end', marginTop: -4 }}>
          <Text variant="label" color="primary">Forgot password?</Text>
        </Link>

        <View style={{ height: theme.spacing.sm }} />

        <BondButton label="Log in" onPress={handleLogin} loading={loading} fullWidth size="lg" />

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: theme.spacing.xxs }}>
          <Text variant="body" color="secondary">New to Bond?</Text>
          <Link href="/(auth)/signup">
            <Text variant="bodyMedium" color="primary" weight="semibold">Create account</Text>
          </Link>
        </View>

        <Link href="/(auth)/welcome" style={{ alignSelf: 'center', marginTop: theme.spacing.sm }}>
          <Text variant="label" color="muted">Back</Text>
        </Link>
      </View>
    </Screen>
  );
}
