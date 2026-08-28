/**
 * Bond design tokens — colors.
 *
 * The palette is built around a calm, premium violet ("Bond Purple")
 * with warm neutrals and a supporting accent ("Bond Coral").
 */

export const colors = {
  // Brand
  primary: '#7C5CFF',
  primaryPressed: '#6A47F2',
  primarySoft: '#EFEaff',
  primaryFaint: '#F6F3FF',

  // Support accent
  accent: '#FF6B8A',
  accentSoft: '#FFE9EF',

  // Semantic
  success: '#2BAD76',
  successSoft: '#E4F7EE',
  warning: '#F59E0B',
  warningSoft: '#FEF3E2',
  danger: '#E5484D',
  dangerSoft: '#FCECEC',
  info: '#3B82F6',
  infoSoft: '#E8F0FE',

  // Neutrals (dark theme base)
  ink900: '#0E0B16',
  ink800: '#171227',
  ink700: '#221B38',
  ink600: '#2E254A',
  ink500: '#4A3F6B',

  // Text
  textPrimaryDark: '#F6F4FF',
  textSecondaryDark: '#B7ADC9',
  textMutedDark: '#7E7296',

  textPrimaryLight: '#1B1430',
  textSecondaryLight: '#5C5470',
  textMutedLight: '#8B84A0',

  // Surfaces (dark theme)
  surfaceDark: '#171227',
  surfaceRaisedDark: '#1F1833',
  surfaceOverlayDark: 'rgba(14, 11, 22, 0.86)',

  // Surfaces (light theme)
  surfaceLight: '#FFFFFF',
  surfaceRaisedLight: '#F7F5FD',
  surfaceOverlayLight: 'rgba(255, 255, 255, 0.9)',

  // Borders
  borderDark: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(27,20,48,0.08)',

  // Classic white (for toast text, contrast)
  white: '#FFFFFF',

  // Bond Lock gold tint
  gold: '#F0B429',
  goldSoft: '#FCF3D9',
} as const;

export type ColorName = keyof typeof colors;
