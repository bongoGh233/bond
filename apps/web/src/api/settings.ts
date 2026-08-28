import { supabase, isBackendConfigured } from '../supabase';

/**
 * User preferences persisted to `user_settings.settings` (JSONB) when a
 * backend is configured, or localStorage in preview mode. `push_notifications`
 * and `quiet_hours` are honored server-side by the push pipeline.
 */
export interface AppSettings {
  activityStatus: boolean;
  pushNotifications: boolean;
  iNeedYou: boolean;
  quietHours: boolean;
  sounds: boolean;
}

const DEFAULTS: AppSettings = {
  activityStatus: true,
  pushNotifications: true,
  iNeedYou: true,
  quietHours: false,
  sounds: true,
};

const PREVIEW_KEY = 'bond.preview-settings.v1';

function toStorage(s: AppSettings): string {
  return JSON.stringify(s);
}

function fromStorage(): Partial<AppSettings> | null {
  try {
    const raw = window.localStorage.getItem(PREVIEW_KEY);
    return raw ? (JSON.parse(raw) as Partial<AppSettings>) : null;
  } catch {
    return null;
  }
}

function toJsonb(s: AppSettings): Record<string, unknown> {
  return {
    activity_status: s.activityStatus,
    push_notifications: s.pushNotifications,
    i_need_you: s.iNeedYou,
    quiet_hours: s.quietHours ? { enabled: true } : { enabled: false },
    sounds: s.sounds,
  };
}

const FROM_JSONB = (s: Record<string, unknown> | undefined): AppSettings => ({
  activityStatus: s?.activity_status !== false,
  pushNotifications: s?.push_notifications !== false,
  iNeedYou: s?.i_need_you !== false,
  quietHours: (s?.quiet_hours as { enabled?: boolean } | undefined)?.enabled === true,
  sounds: s?.sounds !== false,
});

export async function getAppSettings(userId: string): Promise<AppSettings> {
  if (isBackendConfigured && supabase) {
    const { data } = await supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle();
    return FROM_JSONB(data?.settings as Record<string, unknown> | undefined);
  }
  return { ...DEFAULTS, ...fromStorage() };
}

export async function updateAppSettings(userId: string, patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await getAppSettings(userId)), ...patch };
  if (isBackendConfigured && supabase) {
    await supabase.from('user_settings').upsert({ user_id: userId, settings: toJsonb(next) });
    return next;
  }
  window.localStorage.setItem(PREVIEW_KEY, toStorage(next));
  return next;
}