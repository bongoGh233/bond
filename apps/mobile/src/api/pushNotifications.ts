import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase, isBackendConfigured } from './supabase';

export interface PushDevice {
  id: string;
  platform: string;
  token: string | null;
  isCurrent: boolean;
  lastSeenAt: string;
}

interface UserDeviceRow {
  id: string;
  platform: string;
  token: string | null;
  is_current: boolean;
  last_seen_at: string;
}

/**
 * Configure how the system presents notifications while the app is open:
 * banners in the notification list with sound. Native-only (no-op on web).
 */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function deviceName(): string {
  if (Device.deviceName) return Device.deviceName;
  const model = Device.modelName;
  if (model) return model;
  return Platform.OS === 'ios' ? 'iPhone / iPad' : Platform.OS === 'android' ? 'Android device' : 'Bond device';
}

/**
 * Request notification permission, fetch an Expo push token and upsert this
 * device's registration into `user_devices`.
 *
 * Native-only and a no-op in preview mode (no backend), matching the rest of
 * the API layer.
 */
export async function registerPushToken(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isBackendConfigured || !supabase) return { ok: true };
  if (Platform.OS === 'web') return { ok: false, error: 'Push notifications are not supported on web yet.' };
  if (!Device.isDevice) {
    return { ok: false, error: 'Push notifications require a physical device.' };
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    const status =
      current.status === 'granted'
        ? current.status
        : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') {
      return { ok: false, error: 'Notification permission was denied.' };
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return { ok: false, error: 'Could not acquire a push token.' };

    const { error } = await supabase.from('user_devices').upsert(
      {
        user_id: userId,
        device_name: deviceName(),
        platform: Platform.OS,
        token,
        last_seen_at: new Date().toISOString(),
        is_current: true,
      },
      { onConflict: 'token' }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to register for push notifications.' };
  }
}

/**
 * All registered devices for the current user (for seeing/revoking access).
 */
export async function listDevices(userId: string): Promise<PushDevice[]> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('user_devices')
      .select('id, platform, token, is_current, last_seen_at')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });
    if (error || !data) return [];
    return (data as unknown as UserDeviceRow[]).map((d) => ({
      id: d.id,
      platform: d.platform,
      token: d.token,
      isCurrent: d.is_current,
      lastSeenAt: d.last_seen_at,
    }));
  }
  return [];
}

/**
 * Revoke a device's push registration.
 */
export async function removeDevice(userId: string, deviceId: string): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const { error } = await supabase.from('user_devices').delete().eq('id', deviceId).eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  return { ok: true };
}