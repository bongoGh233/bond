/** Spacing scale (px). */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,
} as const;

/** Corner radii. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  pill: 999,
} as const;

/** Layout dimensions. */
export const layout = {
  screenPadding: 20,
  maxContentWidth: 560,
  avatarSizes: {
    xs: 32,
    sm: 40,
    md: 52,
    lg: 72,
    xl: 104,
  },
} as const;

/** Motion durations (ms). */
export const motion = {
  fast: 120,
  normal: 220,
  slow: 340,
} as const;
