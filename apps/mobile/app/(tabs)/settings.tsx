import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import { Text } from '@/src/components/ui/Text';
import { Avatar } from '@/src/components/ui/Avatar';
import { SettingsGroup, SettingsRow } from '@/src/components/ui/SettingsRow';
import { BondButton } from '@/src/components/ui/Button';

export default function SettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut } = useAuth();

  const name = session?.displayName || 'Bond Member';
  const bondId = session?.bondId || 'bond_demo';

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.layout.screenPadding, paddingBottom: insets.bottom + theme.spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.push('/profile')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: theme.spacing.lg,
            marginTop: theme.spacing.sm,
            marginBottom: theme.spacing.lg,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Avatar spec={{ styleId: 0, colorId: 0, initials: name }} size={64} />
          <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
            <Text variant="subheading" weight="bold" numberOfLines={1}>{name}</Text>
            <Text variant="caption" color="primary">@{bondId}</Text>
            <Text variant="micro" color="muted" numberOfLines={1}>Tap to view profile & settings</Text>
          </View>
        </Pressable>

        <SettingsGroup title="Account">
          <SettingsRow icon="person-outline" label="Profile" onPress={() => router.push('/profile')} />
          <SettingsRow icon="badge" label="Bond ID" value={bondId} onPress={() => router.push('/profile')} />
          <SettingsRow icon="devices" label="Connected devices" onPress={() => router.push('/sessions')} last />
        </SettingsGroup>

        <SettingsGroup title="Privacy">
          <SettingsRow icon="visibility" label="Profile visibility" onPress={() => router.push('/privacy')} />
          <SettingsRow icon="notifications-active" label="Activity status" onPress={() => router.push('/privacy')} />
          <SettingsRow icon="auto-awesome" label="Moment visibility" onPress={() => router.push('/privacy')} />
          <SettingsRow icon="group-remove" label="Connection controls" onPress={() => router.push('/privacy')} last />
        </SettingsGroup>

        <SettingsGroup title="Notifications">
          <SettingsRow icon="notifications-active" label="Notification center" onPress={() => router.push('/notifications')} />
          <SettingsRow icon="notifications-none" label="Message notifications" />
          <SettingsRow icon="emergency" label="I Need You" value="On" iconColor={theme.colors.accent} />
          <SettingsRow icon="bedtime" label="Quiet hours" />
          <SettingsRow icon="music-note" label="Sounds & badges" last />
        </SettingsGroup>

        <SettingsGroup title="Moments & Care">
          <SettingsRow icon="mic" label="Voice Diary" onPress={() => router.push('/voice-diary')} />
          <SettingsRow icon="redeem" label="Surprise box" onPress={() => router.push('/surprise-box')} />
          <SettingsRow icon="emergency" label="I Need You" value="On" iconColor={theme.colors.danger} onPress={() => router.push('/i-need-you')} last />
        </SettingsGroup>

        <SettingsGroup title="Security">
          <SettingsRow icon="shield" label="Bond Lock & access" onPress={() => router.push('/bond-lock')} />
          <SettingsRow icon="security" label="Session management" onPress={() => router.push('/sessions')} />
          <SettingsRow icon="lock-outline" label="Device security" last />
        </SettingsGroup>

        <SettingsGroup title="General">
          <SettingsRow icon="apps" label="Appearance & theme" onPress={() => router.push('/appearance')} />
          <SettingsRow icon="help-outline" label="Help & support" onPress={() => router.push('/help')} last />
        </SettingsGroup>

        <View style={{ marginTop: theme.spacing.md }}>
          <BondButton label="Log out" variant="outline" onPress={handleLogout} fullWidth />
        </View>
        <Text variant="micro" color="muted" align="center" style={{ marginTop: theme.spacing.lg }}>
          Bond v0.1.0 · Private by design
        </Text>
      </ScrollView>
    </View>
  );
}
