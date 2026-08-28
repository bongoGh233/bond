/**
 * Bond typography scale.
 * Uses system fonts for reliability across iOS/Android/Expo Go.
 */
export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 34,
    '4xl': 44,
  },
  lineHeights: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 27,
    xl: 32,
    '2xl': 38,
    '3xl': 44,
    '4xl': 54,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },
} as const;
