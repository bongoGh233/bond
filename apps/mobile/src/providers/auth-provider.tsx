import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase, isBackendConfigured } from '@/src/api/supabase';
import { signOutRemote } from '@/src/api/auth';

/**
 * Bond session/auth state.
 *
 * Phase 1: a stub that restores any stored session and exposes the auth
 * lifecycle surface. Phase 2 wires this to Supabase Auth.
 *
 * The access token is kept in the OS Secure Enclave / Keychain via
 * expo-secure-store — never in AsyncStorage or plain code.
 */

const SESSION_KEY = 'bond.session.v1';

export interface BondSession {
  accessToken: string;
  userId: string;
  email?: string | null;
  bondId?: string | null;
  displayName?: string | null;
}

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  session: BondSession | null;
  /**
   * Async sign-in. Phase 2 supersedes this with Supabase signIn.
   * Returns true on success.
   */
  signIn: (session: BondSession) => Promise<boolean>;
  refreshUser: (patch: Partial<BondSession>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parseSession(raw: string | null): BondSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.accessToken === 'string' && typeof parsed.userId === 'string') {
      return parsed as BondSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<BondSession | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Prefer Supabase's persisted session when the backend is configured.
        if (isBackendConfigured && supabase) {
          const { data } = await supabase.auth.getSession();
          const s = data.session;
          if (s?.user) {
            setSession({
              accessToken: s.access_token,
              userId: s.user.id,
              email: s.user.email,
              displayName: (s.user.user_metadata?.display_name as string) ?? undefined,
              bondId: (s.user.user_metadata?.bond_id as string) ?? undefined,
            });
            setStatus('signedIn');
            return;
          }
          setStatus('signedOut');
          return;
        }

        // Preview mode — restore a locally stored session.
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        const restored = parseSession(raw);
        setSession(restored);
        setStatus(restored ? 'signedIn' : 'signedOut');
      } catch {
        setStatus('signedOut');
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      signIn: async (newSession) => {
        try {
          await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(newSession));
          setSession(newSession);
          setStatus('signedIn');
          return true;
        } catch {
          return false;
        }
      },
      refreshUser: async (patch) => {
        setSession((prev) => {
          if (!prev) return prev;
          const next = { ...prev, ...patch };
          SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      },
      signOut: async () => {
        await signOutRemote();
        await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
        setSession(null);
        setStatus('signedOut');
      },
    }),
    [status, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
