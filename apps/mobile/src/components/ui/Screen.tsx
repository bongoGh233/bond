import React, { type PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/providers/theme-provider';

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  scrollProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle'>;
  padded?: boolean;
  keyboardAvoiding?: boolean;
  style?: object;
  contentContainerStyle?: object;
  refreshControl?: ScrollViewProps['refreshControl'];
}

export function Screen({
  children,
  scroll = true,
  scrollProps,
  padded = true,
  keyboardAvoiding = false,
  style,
  contentContainerStyle,
  refreshControl,
}: ScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const horizontalPadding = padded ? theme.layout.screenPadding : 0;

  const inner = (
    <View style={{ flex: 1, paddingHorizontal: horizontalPadding }}>
      {children}
    </View>
  );

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        { paddingBottom: insets.bottom + theme.spacing.xl },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      {...scrollProps}
    >
      {inner}
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>{inner}</View>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, style]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[styles.flex, style, { backgroundColor: theme.colors.background }]}>{content}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
