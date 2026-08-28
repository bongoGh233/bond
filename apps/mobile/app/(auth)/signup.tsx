import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import { signUp as apiSignUp } from '@/src/api/auth';
import { Screen } from '@/src/components/ui/Screen';
import { Text } from '@/src/components/ui/Text';
import { BondInput } from '@/src/components/ui/Input';
import { BondButton } from '@/src/components/ui/Button';

export default function SignupScreen() {
  const { theme } = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const result = await apiSignUp({
      email: email.trim(),
      password,
      displayName: name.trim(),
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await signIn(result.session);
    // Onboarding lets the user finalize their Bond ID, avatar and privacy.
    router.replace('/(auth)/onboarding');
  };

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: theme.spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ marginBottom: theme.spacing.md }}>
            <Text variant="heading" weight="semibold">Create your account</Text>
            <Text variant="body" color="secondary">Set up your Bond space</Text>
          </View>

          <BondInput
            label="Display name"
            icon="person-outline"
            placeholder="What should people call you?"
            value={name}
            onChangeText={setName}
          />
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
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <BondInput
            label="Confirm password"
            icon="lock-outline"
            placeholder="Repeat your password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          {error ? <Text variant="caption" color="danger">{error}</Text> : null}

          <BondButton label="Create account" onPress={handleSignup} loading={loading} fullWidth size="lg" />

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: theme.spacing.xxs }}>
            <Text variant="body" color="secondary">Already have an account?</Text>
            <Link href="/(auth)/login">
              <Text variant="bodyMedium" color="primary" weight="semibold">Log in</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
