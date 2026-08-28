import { supabase, isBackendConfigured } from './supabase';

export interface ProfileInput {
  displayName?: string;
  bondId?: string;
  bio?: string;
  avatarStyle?: number;
  avatarColor?: number;
}

/**
 * Update the current user's profile row.
 * In Supabase mode this writes to `profiles` (RLS allows the owner only).
 * Preview mode is a no-op placeholder (UI can still update the local session).
 */
export async function updateProfile(input: ProfileInput): Promise<{ ok: boolean; error?: string }> {
  if (isBackendConfigured && supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not signed in.' };

    const patch: Record<string, unknown> = {};
    if (input.displayName !== undefined) patch.display_name = input.displayName;
    if (input.bondId !== undefined) patch.bond_id = input.bondId;
    if (input.bio !== undefined) patch.bio = input.bio;
    if (input.avatarStyle !== undefined) patch.avatar_style = input.avatarStyle;
    if (input.avatarColor !== undefined) patch.avatar_color = input.avatarColor;

    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) return { ok: false, error: error.message };

    if (input.displayName !== undefined || input.bondId !== undefined) {
      await supabase.auth.updateUser({
        data: { display_name: input.displayName, bond_id: input.bondId },
      }).catch(() => {});
    }
    return { ok: true };
  }
  return { ok: true };
}

export async function fetchProfile(userId: string): Promise<{
  displayName?: string;
  bondId?: string;
  bio?: string;
  avatarStyle?: number;
  avatarColor?: number;
} | null> {
  if (isBackendConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, bond_id, bio, avatar_style, avatar_color')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      displayName: data.display_name,
      bondId: data.bond_id,
      bio: data.bio,
      avatarStyle: data.avatar_style,
      avatarColor: data.avatar_color,
    };
  }
  return null;
}
