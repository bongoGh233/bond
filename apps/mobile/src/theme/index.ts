import { colors } from './colors';
import { typography } from './typography';
import { spacing, radius, layout, motion } from './spacing';

export type ThemeMode = 'light' | 'dark';

export interface BondTheme {
  mode: ThemeMode;
  colors: {
    primary: string;
    primaryPressed: string;
    primarySoft: string;
    primaryFaint: string;
    accent: string;
    accentSoft: string;
    success: string;
    successSoft: string;
    warning: string;
    warningSoft: string;
    danger: string;
    dangerSoft: string;
    info: string;
    infoSoft: string;
    gold: string;
    goldSoft: string;
    background: string;
    surface: string;
    surfaceRaised: string;
    overlay: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    onPrimary: string;
    inputBackground: string;
  };
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  layout: typeof layout;
  motion: typeof motion;
}

const lightTheme: BondTheme = {
  mode: 'light',
  colors: {
    primary: colors.primary,
    primaryPressed: colors.primaryPressed,
    primarySoft: colors.primarySoft,
    primaryFaint: colors.primaryFaint,
    accent: colors.accent,
    accentSoft: colors.accentSoft,
    success: colors.success,
    successSoft: colors.successSoft,
    warning: colors.warning,
    warningSoft: colors.warningSoft,
    danger: colors.danger,
    dangerSoft: colors.dangerSoft,
    info: colors.info,
    infoSoft: colors.infoSoft,
    gold: colors.gold,
    goldSoft: colors.goldSoft,
    background: colors.surfaceLight,
    surface: colors.surfaceLight,
    surfaceRaised: colors.surfaceRaisedLight,
    overlay: colors.surfaceOverlayLight,
    border: colors.borderLight,
    text: colors.textPrimaryLight,
    textSecondary: colors.textSecondaryLight,
    textMuted: colors.textMutedLight,
    onPrimary: colors.white,
    inputBackground: colors.surfaceRaisedLight,
  },
  typography,
  spacing,
  radius,
  layout,
  motion,
};

const darkTheme: BondTheme = {
  mode: 'dark',
  colors: {
    primary: colors.primary,
    primaryPressed: colors.primaryPressed,
    primarySoft: colors.primarySoft,
    primaryFaint: colors.primaryFaint,
    accent: colors.accent,
    accentSoft: colors.accentSoft,
    success: colors.success,
    successSoft: colors.successSoft,
    warning: colors.warning,
    warningSoft: colors.warningSoft,
    danger: colors.danger,
    dangerSoft: colors.dangerSoft,
    info: colors.info,
    infoSoft: colors.infoSoft,
    gold: colors.gold,
    goldSoft: colors.goldSoft,
    background: colors.ink900,
    surface: colors.surfaceDark,
    surfaceRaised: colors.surfaceRaisedDark,
    overlay: colors.surfaceOverlayDark,
    border: colors.borderDark,
    text: colors.textPrimaryDark,
    textSecondary: colors.textSecondaryDark,
    textMuted: colors.textMutedDark,
    onPrimary: colors.white,
    inputBackground: colors.ink700,
  },
  typography,
  spacing,
  radius,
  layout,
  motion,
};

export const themes: Record<ThemeMode, BondTheme> = {
  light: lightTheme,
  dark: darkTheme,
};

export { colors, typography, spacing, radius, layout, motion };
export * from './colors';
