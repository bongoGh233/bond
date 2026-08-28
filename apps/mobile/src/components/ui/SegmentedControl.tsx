import React from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '@/src/providers/theme-provider';
import { Text } from './Text';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.inputBackground,
        borderRadius: theme.radius.lg,
        padding: 4,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 40,
              borderRadius: theme.radius.md,
              backgroundColor: active ? theme.colors.primary : 'transparent',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              variant="label"
              weight="semibold"
              color={active ? 'onPrimary' : 'secondary'}
            >
              {opt.label}
            </Text>
            {opt.badge !== undefined && opt.badge > 0 ? (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? 'rgba(255,255,255,0.25)' : theme.colors.accent,
                }}
              >
                <Text variant="micro" weight="bold" color={active ? 'onPrimary' : 'onPrimary'} style={{ color: '#fff' }}>
                  {opt.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
