import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from './Text';

/**
 * Avatar palette + icon set used for privacy-friendly, generated avatars.
 * No paid avatar service required — Bond generates a gradient-free,
 * color-block avatar from a chosen style + the user's initials.
 */

export const avatarPalette = [
  '#7C5CFF', // Bond Purple
  '#FF6B8A', // Bond Coral
  '#2BAD76', // Emerald
  '#3B82F6', // Azure
  '#F0B429', // Gold
  '#F97316', // Tangerine
  '#0EA5E9', // Sky
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#14B8A6', // Teal
] as const;

export const avatarIcons = [
  'favorite',
  'star',
  'bolt',
  'favorite-border',
  'flare',
  'spa',
  'rocket-launch',
  'favorite',
  'diamond',
  'eco',
] as const;

type AvatarStyleId = number;

export interface AvatarSpec {
  styleId: number;
  colorId: number;
  initials: string;
  /** Optional image URI override (profile photo uploads). */
  uri?: string | null;
}

interface AvatarProps {
  spec: Partial<AvatarSpec>;
  size?: number;
  style?: ViewStyle;
  showBorder?: boolean;
}

export function Avatar({ spec, size = 52, style, showBorder = false }: AvatarProps) {
  const color = avatarPalette[spec.colorId ?? 0] ?? avatarPalette[0];

  // NOTE: Real profile photo uploads are an optional later phase (Phase 6+).
  // `spec.uri` is reserved for them. Until image upload is wired up, we render
  // the generated avatar. See src/README for the production storage plan.

  const icon = avatarIcons[(spec.styleId ?? 0) % avatarIcons.length];
  const initials = (spec.initials || '?').slice(0, 2).toUpperCase();
  const useIconShape = (spec.styleId ?? 0) % 2 === 0;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: showBorder ? 2 : 0,
          borderColor: 'rgba(255,255,255,0.25)',
        },
        style,
      ]}
    >
      {useIconShape ? (
        <MaterialIcons
          name={icon}
          size={size * 0.46}
          color="rgba(255,255,255,0.95)"
        />
      ) : (
        <Text
          variant="subheading"
          color="onPrimary"
          weight="bold"
          style={{ fontSize: size * 0.38, color: 'rgba(255,255,255,0.96)' }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
