import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/src/providers/theme-provider';
import { Text } from './ui/Text';

interface BrandMarkProps {
  size?: number;
  showWordmark?: boolean;
}

/**
 * Bond's logo: an abstract "linked rings / people" mark built from two
 * overlapping rounded knots — representing two connected people.
 */
export function BrandMark({ size = 56, showWordmark = true }: BrandMarkProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { gap: showWordmark ? 12 : 0, alignItems: 'center' }]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-8deg' }],
        }}
      >
        <MaterialIcons name="favorite" size={size * 0.5} color="white" />
      </View>
      {showWordmark ? (
        <Text variant="title" weight="heavy" style={{ letterSpacing: -0.5 }}>
          Bond
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
});
