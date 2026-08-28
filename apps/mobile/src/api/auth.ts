import { supabase, isBackendConfigured } from './supabase';
import type { BondSession } from '@/src/providers/auth-provider';

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  bondId?: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export type AuthResult =
  | { ok: true; session: BondSession }
  | { ok: false; error: string };

/**
 * Sign up a new user.
 *
 * Supabase mode: creates an auth user; the DB trigger auto-creates a profile
 * and user_settings row. Returns a session.
 * Preview mode: returns a local demo session.
 */
export async function signUp({ email, password, displayName, bondId }: SignUpInput): Promise<AuthResult> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, bond_id: bondId },
      },
    });
    if (error) return { ok: false, error: error.message };
    const user = data.user;
    if (!user) return { ok: false, error: 'No account returned.' };
    return {
      ok: true,
      session: {
        accessToken: data.session?.access_token ?? 'preview',
        userId: user.id,
        email,
        displayName: displayName || undefined,
        bondId: bondId || undefined,
      },
    };
  }

  // Preview mode — local demo session.
  return {
    ok: true,
    session: {
      accessToken: 'preview-token',
      userId: `local-${Date.now()}`,
      email,
      displayName: displayName || undefined,
      bondId: bondId || undefined,
    },
  };
}

export async function signIn({ email, password }: SignInInput): Promise<AuthResult> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    const user = data.user;
    if (!user) return { ok: false, error: 'No account returned.' };
    return {
      ok: true,
      session: {
        accessToken: data.session?.access_token ?? 'preview',
        userId: user.id,
        email,
      },
    };
  }

  // Preview mode — accept any credentials for exploration.
  return {
    ok: true,
    session: {
      accessToken: 'preview-token',
      userId: `local-${Date.now()}`,
      email,
    },
  };
}

export async function signOutRemote(): Promise<void> {
  if (isBackendConfigured && supabase) {
    await supabase.auth.signOut();
  }
}
