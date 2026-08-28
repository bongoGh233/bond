import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/src/providers/theme-provider';

type IconName = keyof typeof MaterialIcons.glyphMap;

export default function TabsLayout() {
  const { theme } = useTheme();
  const tint = theme.colors.primary;
  const muted = theme.colors.textMuted;

  const tab = (label: string, icon: IconName, focusedIcon: IconName) => ({
    tabBarLabel: label,
    tabBarIcon: ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
      <MaterialIcons name={focused ? focusedIcon : icon} size={size} color={color} />
    ),
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.sizes.xs,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Chats', ...tab('Chats', 'chat-bubble-outline', 'chat-bubble') }} />
      <Tabs.Screen name="moments" options={{ title: 'Moments', ...tab('Moments', 'auto-awesome', 'auto-awesome') }} />
      <Tabs.Screen name="connections" options={{ title: 'Connections', ...tab('Connections', 'diversity-1', 'diversity-3') }} />
      <Tabs.Screen name="shared" options={{ title: 'Shared', ...tab('Shared', 'auto-stories', 'auto-stories') }} />
      <Tabs.Screen name="settings" options={{ title: 'You', ...tab('You', 'person-outline', 'person') }} />
    </Tabs>
  );
}
