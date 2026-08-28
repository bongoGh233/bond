import React, { useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/src/providers/theme-provider';
import { Text } from './Text';

interface BondInputProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  error?: string | null;
  rightAccessory?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function BondInput({
  label,
  icon,
  error,
  rightAccessory,
  containerStyle,
  style,
  secureTextEntry,
  ...rest
}: BondInputProps) {
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;
  const actualSecure = isPassword ? !showPassword : false;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" color="secondary" style={{ marginBottom: theme.spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.inputBackground,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            paddingHorizontal: theme.spacing.md,
            minHeight: 52,
          },
        ]}
      >
        {icon ? (
          <MaterialIcons name={icon} size={20} color={theme.colors.textMuted} style={{ marginRight: theme.spacing.sm }} />
        ) : null}
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={actualSecure}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            {
              flex: 1,
              color: theme.colors.text,
              fontSize: theme.typography.sizes.md,
              paddingVertical: theme.spacing.sm,
            },
            style,
          ]}
          {...rest}
        />
        {isPassword ? (
          <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
            <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color={theme.colors.textMuted} />
          </Pressable>
        ) : rightAccessory ? (
          rightAccessory
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger" style={{ marginTop: theme.spacing.xxs }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
