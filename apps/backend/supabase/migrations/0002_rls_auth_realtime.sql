-- =============================================================================
-- Bond — Migrations 0002: enforce RLS, auth-triggered profiles, realtime
-- -----------------------------------------------------------------------------
-- This migration is a hard safety net: EVERY table has Row Level Security
-- explicitly enabled. Even if RLS were off by default, the anon key cannot
-- read private rows after this runs.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Enable RLS on every Bond table.
-- ---------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.user_settings          enable row level security;
alter table public.user_devices           enable row level security;
alter table public.connections            enable row level security;
alter table public.conversations          enable row level security;
alter table public.conversation_members   enable row level security;
alter table public.messages               enable row level security;
alter table public.bond_lock_grants       enable row level security;
alter table public.moments                enable row level security;
alter table public.moment_views           enable row level security;
alter table public.shared_spaces          enable row level security;
alter table public.shared_space_members   enable row level security;
alter table public.memories               enable row level security;
alter table public.bucket_list_items      enable row level security;
alter table public.voice_diaries          enable row level security;
alter table public.surprise_boxes         enable row level security;
alter table public.i_need_you             enable row level security;
alter table public.i_need_you_prefs       enable row level security;
alter table public.notifications          enable row level security;

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a new auth user signs up.
-- Generates a graceful Bond ID placeholder that the onboarding flow updates.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, bond_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(new.raw_user_meta_data->>'bond_id',
             'bond_' || substr(replace(new.id::text,'-',''), 1, 10))
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Optionally cascade a device record from signup metadata.
create or replace function public.handle_new_user_device()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_devices (user_id, device_name, platform, is_current)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'device_name', 'Bond on your device'),
    coalesce(new.raw_user_meta_data->>'platform', 'unknown'),
    true
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created_device on auth.users;
create trigger on_auth_user_created_device
  after insert on auth.users
  for each row execute function public.handle_new_user_device();

-- ===========================================================================
-- Realtime: publish these tables for live updates via Supabase Realtime.
-- ===========================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.i_need_you;
alter publication supabase_realtime add table public.connections;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.moments;

commit;
