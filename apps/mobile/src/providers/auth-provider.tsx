import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { supabase, isBackendConfigured } from '@/src/api/supabase';
import { signOutRemote } from '@/src/api/auth';

/**
 * Bond session/auth state.
 *
 * Backed by Supabase Auth. When the backend is configured, the session is
 * restored from Supabase's own persisted storage (the OS Keychain /
 * Secure Enclave via expo-secure-store through the supabase storage adapter).
 */

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
   * Sets the in-memory session state. Returns true on success.
   */
  signIn: (session: BondSession) => Promise<boolean>;
  refreshUser: (patch: Partial<BondSession>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<BondSession | null>(null);

  useEffect(() => {
    if (!isBackendConfigured || !supabase) {
      setStatus('signedOut');
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
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
      } else {
        setStatus('signedOut');
      }
    }).catch(() => setStatus('signedOut'));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      signIn: async (newSession) => {
        setSession(newSession);
        setStatus('signedIn');
        return true;
      },
      refreshUser: async (patch) => {
        setSession((prev) => {
          if (!prev) return prev;
          return { ...prev, ...patch };
        });
      },
      signOut: async () => {
        await signOutRemote();
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
