import React, { type PropsWithChildren } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/providers/theme-provider';

interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  raised?: boolean;
  padded?: boolean;
}

export function Card({ children, onPress, style, innerStyle, raised = false, padded = true }: CardProps) {
  const { theme } = useTheme();
  const base: ViewStyle = {
    backgroundColor: raised ? theme.colors.surfaceRaised : theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: padded ? theme.spacing.lg : 0,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, style, pressed ? { opacity: 0.9, transform: [{ scale: 0.985 }] } : null]}
      >
        <View style={innerStyle}>{children}</View>
      </Pressable>
    );
  }

  return (
    <View style={[base, style]}>
      <View style={innerStyle}>{children}</View>
    </View>
  );
}
