import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import { updateProfile } from '@/src/api/profiles';
import { Screen } from '@/src/components/ui/Screen';
import { Text } from '@/src/components/ui/Text';
import { BondInput } from '@/src/components/ui/Input';
import { BondButton } from '@/src/components/ui/Button';
import { Avatar, avatarPalette } from '@/src/components/ui/Avatar';

type Step = 'bondId' | 'avatar' | 'privacy';

const STEPS: Step[] = ['bondId', 'avatar', 'privacy'];

const PRIVACY_OPTIONS = [
  { id: 'everyone', label: 'Everyone', desc: 'Anyone on Bond can find you by Bond ID' },
  { id: 'connections', label: 'Connections only', desc: 'Only people you connect with can see you' },
  { id: 'nobody', label: 'Nobody', desc: 'Stay completely hidden (manual invites only)' },
] as const;

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { session, refreshUser } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const [bondId, setBondId] = useState('');
  const [bondIdError, setBondIdError] = useState<string | null>(null);
  const [avatarStyle, setAvatarStyle] = useState(0);
  const [avatarColor, setAvatarColor] = useState(0);
  const [visibility, setVisibility] = useState<'everyone' | 'connections' | 'nobody'>('connections');
  const [saving, setSaving] = useState(false);

  const initials = (bondId || session?.displayName || 'B').slice(0, 2);

  const validateBondId = () => {
    const value = bondId.trim();
    if (!/^[a-z0-9_]{3,24}$/.test(value)) {
      setBondIdError('Use 3–24 lowercase letters, numbers, or underscores.');
      return false;
    }
    setBondIdError(null);
    return true;
  };

  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));

  const finish = async () => {
    setSaving(true);
    await updateProfile({
      bondId: bondId.trim().toLowerCase() || undefined,
      avatarStyle,
      avatarColor,
    });
    await refreshUser({
      bondId: bondId.trim().toLowerCase() || session?.bondId || undefined,
    });
    setSaving(false);
    router.replace('/(tabs)');
  };

  const canContinue = step !== 'bondId' || (bondId.trim().length > 0 && !bondIdError);

  return (
    <Screen padded>
      <View style={{ flex: 1 }}>
        {/* Progress indicator */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: theme.radius.pill,
                backgroundColor: i <= stepIndex ? theme.colors.primary : theme.colors.border,
              }}
            />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: theme.spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'bondId' && (
            <View style={{ flex: 1, gap: theme.spacing.md }}>
              <Text variant="title" weight="bold">Choose your Bond ID</Text>
              <Text variant="body" color="secondary">
                This is how trusted people find and connect with you. It's like your username — pick something you love.
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="bodyMedium" color="muted">@</Text>
                <View style={{ flex: 1 }}>
                  <BondInput
                    placeholder="your_bond_id"
                    value={bondId}
                    onChangeText={(t) => {
                      setBondId(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                      setBondIdError(null);
                    }}
                    autoCapitalize="none"
                    error={bondIdError}
                  />
                </View>
              </View>
              <Text variant="caption" color="muted">
                Letters, numbers and underscores only. 3–24 characters.
              </Text>
            </View>
          )}

          {step === 'avatar' && (
            <View style={{ flex: 1, gap: theme.spacing.lg }}>
              <Text variant="title" weight="bold">Pick your avatar</Text>
              <Text variant="body" color="secondary">Choose a style and color. No photo uploads needed — Bond keeps it simple and private.</Text>

              <View style={{ alignItems: 'center', marginVertical: theme.spacing.md }}>
                <Avatar spec={{ styleId: avatarStyle, colorId: avatarColor, initials }} size={112} />
              </View>

              <View>
                <Text variant="label" color="secondary" style={{ marginBottom: theme.spacing.xs }}>Style</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setAvatarStyle(s)}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: theme.radius.lg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: s === avatarStyle ? theme.colors.primarySoft : theme.colors.inputBackground,
                        borderWidth: 2,
                        borderColor: s === avatarStyle ? theme.colors.primary : 'transparent',
                      }}
                    >
                      <Avatar spec={{ styleId: s, colorId: avatarColor, initials }} size={40} />
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text variant="label" color="secondary" style={{ marginBottom: theme.spacing.xs }}>Color</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {avatarPalette.map((c, i) => (
                    <Pressable
                      key={i}
                      onPress={() => setAvatarColor(i)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: c,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: theme.mode === 'dark' ? '#000' : '#fff',
                      }}
                    >
                      {i === avatarColor ? (
                        <MaterialIcons name="check" size={22} color="#fff" />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {step === 'privacy' && (
            <View style={{ flex: 1, gap: theme.spacing.lg }}>
              <Text variant="title" weight="bold">Set your privacy</Text>
              <Text variant="body" color="secondary">Who should be able to find you on Bond?</Text>
              <View style={{ gap: theme.spacing.sm }}>
                {PRIVACY_OPTIONS.map((opt) => {
                  const active = visibility === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setVisibility(opt.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: theme.spacing.md,
                        borderRadius: theme.radius.lg,
                        borderWidth: 2,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                        backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                      }}
                    >
                      <MaterialIcons
                        name={active ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={22}
                        color={active ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <View style={{ marginLeft: theme.spacing.md, flex: 1 }}>
                        <Text variant="bodyMedium" weight="semibold">{opt.label}</Text>
                        <Text variant="caption" color="secondary">{opt.desc}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="micro" color="muted">
                You can change this anytime in Settings → Privacy.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}>
          {stepIndex > 0 ? (
            <BondButton label="Back" variant="ghost" onPress={() => setStepIndex((i) => i - 1)} style={{ flex: 1 }} />
          ) : null}
          {stepIndex < STEPS.length - 1 ? (
            <BondButton
              label="Continue"
              onPress={() => {
                if (step === 'bondId' && !validateBondId()) return;
                next();
              }}
              disabled={!canContinue}
              style={{ flex: 1 }}
            />
          ) : (
            <BondButton label="Start using Bond" onPress={finish} loading={saving} style={{ flex: 1 }} />
          )}
        </View>
      </View>
    </Screen>
  );
}
