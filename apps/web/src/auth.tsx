import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isBackendConfigured } from './supabase';

export interface Session {
  userId: string;
  email: string | null;
  displayName?: string | null;
  bondId?: string | null;
}

interface AuthCtx {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: Session | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (email: string, password: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

function sessionFromEmail(email: string): Session {
  const base = email.split('@')[0] || 'you';
  return { userId: `local-${Date.now()}`, email, displayName: base, bondId: base };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'signedOut' | 'signedIn'>('loading');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!isBackendConfigured || !supabase) {
      setStatus('signedOut');
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s?.user) {
        setSession({
          userId: s.user.id,
          email: s.user.email ?? null,
          displayName: (s.user.user_metadata?.display_name as string) ?? null,
          bondId: (s.user.user_metadata?.bond_id as string) ?? null,
        });
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    });
  }, []);

  const value: AuthCtx = {
    status,
    session,
    login: async (email, password) => {
      if (isBackendConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, error: error.message };
        setSession({
          userId: data.user!.id,
          email: data.user!.email ?? null,
          displayName: (data.user!.user_metadata?.display_name as string) ?? null,
        });
        setStatus('signedIn');
        return { ok: true };
      }
      setSession(sessionFromEmail(email));
      setStatus('signedIn');
      return { ok: true };
    },
    signup: async (email, password, displayName) => {
      if (isBackendConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) return { ok: false, error: error.message };
        if (!data.session) {
          // Email confirmation required.
          return { ok: false, error: 'Check your email to confirm your account, then log in.' };
        }
        setSession({ userId: data.user!.id, email, displayName });
        setStatus('signedIn');
        return { ok: true };
      }
      setSession(sessionFromEmail(email));
      setStatus('signedIn');
      return { ok: true };
    },
    logout: async () => {
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      setStatus('signedOut');
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
