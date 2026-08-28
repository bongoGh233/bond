import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/src/providers/theme-provider';
import { AuthProvider, useAuth } from '@/src/providers/auth-provider';
import { configureNotificationHandler, registerPushToken } from '@/src/api/pushNotifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Present notifications as banners with sound even when the app is focused.
configureNotificationHandler();

function NotificationProvider() {
  const { status, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (status !== 'signedIn' || !session?.userId) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as {
        chatId?: string;
        conversation_id?: string;
        alert_id?: string;
        screen?: string;
      };
      const chatId = data.chatId ?? data.conversation_id;
      if (chatId) {
        router.push({ pathname: '/chat/[id]', params: { id: chatId } } as Href);
      } else if (data.alert_id) {
        router.push('/i-need-you');
      } else if (data.screen) {
        router.push(data.screen as Href);
      }
    });

    registerPushToken(session.userId).catch(() => {});
    return () => subscription.remove();
  }, [status, session?.userId, router]);

  return null;
}

function RootNavigator() {
  const { theme } = useTheme();
  const { status } = useAuth();
  const isLoading = status === 'loading';

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider />
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
