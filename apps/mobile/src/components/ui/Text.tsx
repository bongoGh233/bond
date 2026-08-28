import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/src/providers/theme-provider';

type Variant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyMedium'
  | 'label'
  | 'caption'
  | 'micro';

export interface BondTextProps extends TextProps {
  variant?: Variant;
  color?: 'text' | 'secondary' | 'muted' | 'primary' | 'accent' | 'danger' | 'success' | 'warning' | 'onPrimary';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy';
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  children?: React.ReactNode;
}

const variantStyles: Record<Variant, (t: BondTheme) => TextStyle> = {
  display: (t) => ({ fontSize: t.typography.sizes['4xl'], lineHeight: t.typography.lineHeights['4xl'], fontWeight: t.typography.weights.heavy, letterSpacing: -0.6 }),
  title: (t) => ({ fontSize: t.typography.sizes['2xl'], lineHeight: t.typography.lineHeights['2xl'], fontWeight: t.typography.weights.bold, letterSpacing: -0.4 }),
  heading: (t) => ({ fontSize: t.typography.sizes.xl, lineHeight: t.typography.lineHeights.xl, fontWeight: t.typography.weights.semibold }),
  subheading: (t) => ({ fontSize: t.typography.sizes.lg, lineHeight: t.typography.lineHeights.lg, fontWeight: t.typography.weights.medium }),
  body: (t) => ({ fontSize: t.typography.sizes.md, lineHeight: t.typography.lineHeights.md, fontWeight: t.typography.weights.regular }),
  bodyMedium: (t) => ({ fontSize: t.typography.sizes.md, lineHeight: t.typography.lineHeights.md, fontWeight: t.typography.weights.medium }),
  label: (t) => ({ fontSize: t.typography.sizes.sm, lineHeight: t.typography.lineHeights.sm, fontWeight: t.typography.weights.semibold }),
  caption: (t) => ({ fontSize: t.typography.sizes.sm, lineHeight: t.typography.lineHeights.sm, fontWeight: t.typography.weights.regular }),
  micro: (t) => ({ fontSize: t.typography.sizes.xs, lineHeight: t.typography.lineHeights.xs, fontWeight: t.typography.weights.medium }),
};

// Resolved lazily via useTheme, avoids circular import at module scope.
type BondTheme = ReturnType<typeof useTheme>['theme'];

function resolveColor(color: NonNullable<BondTextProps['color']>, t: BondTheme): string {
  switch (color) {
    case 'text': return t.colors.text;
    case 'secondary': return t.colors.textSecondary;
    case 'muted': return t.colors.textMuted;
    case 'primary': return t.colors.primary;
    case 'accent': return t.colors.accent;
    case 'danger': return t.colors.danger;
    case 'success': return t.colors.success;
    case 'warning': return t.colors.warning;
    case 'onPrimary': return t.colors.onPrimary;
    default: return t.colors.text;
  }
}

export function Text({
  variant = 'body',
  color = 'text',
  weight,
  align,
  style,
  children,
  ...rest
}: BondTextProps) {
  const { theme } = useTheme();
  const base = variantStyles[variant](theme);
  const resolvedColor = resolveColor(color, theme);
  return (
    <RNText
      style={[{ ...base, color: resolvedColor }, weight ? { fontWeight: theme.typography.weights[weight] } : null, align ? { textAlign: align } : null, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
