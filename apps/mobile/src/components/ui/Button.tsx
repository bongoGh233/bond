import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/src/providers/theme-provider';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BondButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function BondButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityLabel,
  testID,
}: BondButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const sizeStyles: Record<ButtonSize, { height: number; radius: number; textVariant: 'bodyMedium' | 'label' | 'subheading' }> = {
    sm: { height: 40, radius: theme.radius.md, textVariant: 'label' },
    md: { height: 52, radius: theme.radius.lg, textVariant: 'bodyMedium' },
    lg: { height: 58, radius: theme.radius.lg, textVariant: 'subheading' },
  };

  const bgColor = (() => {
    if (isDisabled) return theme.colors.primarySoft;
    switch (variant) {
      case 'primary': return theme.colors.primary;
      case 'secondary': return theme.colors.primarySoft;
      case 'ghost': return 'transparent';
      case 'danger': return theme.colors.danger;
      case 'outline': return 'transparent';
    }
  })();

  const textColor = (() => {
    if (isDisabled) return theme.colors.textMuted;
    switch (variant) {
      case 'primary': return theme.colors.onPrimary;
      case 'danger': return theme.colors.onPrimary;
      case 'secondary': return theme.colors.primary;
      case 'ghost': return theme.colors.primary;
      case 'outline': return theme.colors.text;
    }
  })();

  const borderColor = variant === 'outline' ? theme.colors.border : undefined;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: sizeStyles[size].height,
          borderRadius: sizeStyles[size].radius,
          backgroundColor: bgColor,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          paddingHorizontal: theme.spacing.lg,
          width: fullWidth ? '100%' : undefined,
          opacity: pressed && !isDisabled ? 0.86 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text
            variant={sizeStyles[size].textVariant}
            color={variant === 'primary' || variant === 'danger' ? 'onPrimary' : variant === 'secondary' ? 'primary' : variant === 'outline' ? 'text' : 'primary'}
            weight="semibold"
            style={{
              color: textColor,
              marginLeft: icon ? theme.spacing.xs : 0,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
