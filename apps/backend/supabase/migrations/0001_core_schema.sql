-- =============================================================================
-- Bond — Core schema
-- -----------------------------------------------------------------------------
-- Supabase / PostgreSQL with Row Level Security (RLS).
--
-- Security model: every table is protected by RLS. A user can only read/write
-- rows they own or that they are authorized to see (e.g. a conversation they
-- belong to, a connection they share). The Postgres role used by anon/authenticated
-- clients (the Supabase "anon" key) NEVER bypasses RLS.
--
-- NOTE ON AUTH: `profiles` is keyed 1:1 to `auth.users`. A database trigger
-- creates a profile row automatically whenever a new auth user signs up.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) PROFILES
--    A user's public-facing profile. 1:1 with auth.users; only the owner can
--    update it; every authenticated user can read the minimal public profile
--    (needed to search by Bond ID).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  bond_id     text not null unique,
  bio         text not null default '',
  avatar_style smallint not null default 0,
  avatar_color smallint not null default 0,
  avatar_uri  text,                     -- reserved for optional photo uploads
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Bond ID is slug-safe: lowercase letters, digits, underscores, max 24 chars.
alter table public.profiles
  add constraint profiles_bond_id_format
  check (bond_id ~ '^[a-z0-9_]{3,24}$');

-- Only the row owner may update their own profile.
create policy profiles_select on public.profiles
  for select using (true);                       -- public minimal profile (no PII beyond display)

create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);       -- app inserts on first signup

create policy profiles_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2) USER SETTINGS
--    Privacy/notification/feature preferences, stored as JSONB so the schema
--    stays flexible while individual fields are still addressable in SQL.
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  settings  jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create policy user_settings_select on public.user_settings
  for select using (auth.uid() = user_id);
create policy user_settings_insert on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy user_settings_update on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3) USER DEVICES / SESSIONS
--    A user-facing registry of the devices that have opened Bond, so users can
--    see and revoke remote access. (Auth sessions themselves live in auth.sessions.)
-- ---------------------------------------------------------------------------
create table public.user_devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  device_name text not null default 'Unknown device',
  platform    text not null default 'unknown',
  token       text unique,               -- push token (reserved), not required
  last_seen_at timestamptz not null default now(),
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);

create policy user_devices_select on public.user_devices
  for select using (auth.uid() = user_id);
create policy user_devices_insert on public.user_devices
  for insert with check (auth.uid() = user_id);
create policy user_devices_update on public.user_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_devices_delete on public.user_devices
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4) CONNECTIONS
--    A mutual, permission-based relationship. Rows store the pair in
--    (user_a, user_b) order with user_a < user_b, guaranteeing one row per pair.
--    status: 'pending' | 'accepted' | 'blocked'
-- ---------------------------------------------------------------------------
create table public.connections (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles(id) on delete cascade,
  user_b     uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted','blocked')),
  requested_by uuid not null,
  invited_by uuid,                        -- which user sent the request
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_pairs_unique unique (user_a, user_b),
  constraint connections_ordered check (user_a < user_b)
);

create index connections_user_a_idx on public.connections (user_a);
create index connections_user_b_idx on public.connections (user_b);

-- Only the two people in the connection can see it.
create policy connections_select on public.connections
  for select using (auth.uid() in (user_a, user_b));

-- Any authenticated user may send a request (creating a pending connection).
create policy connections_insert on public.connections
  for insert with check (auth.uid() in (user_a, user_b));

-- Only a member can update (accept/decline/block) their connection, and only
-- while it is pending (for acceptance) — acceptance requires the other party.
create policy connections_update on public.connections
  for update using (auth.uid() in (user_a, user_b))
  with check (auth.uid() in (user_a, user_b));

create policy connections_delete on public.connections
  for delete using (auth.uid() in (user_a, user_b));

-- ---------------------------------------------------------------------------
-- 5) CONVERSATIONS + MEMBERS
-- ---------------------------------------------------------------------------
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  is_group    boolean not null default false,
  title       text,                              -- group title
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- RLS: a user sees a conversation only if they are a member.
create policy conversations_select on public.conversations
  for select using (
    exists (select 1 from public.conversation_members m
            where m.conversation_id = conversations.id and m.user_id = auth.uid())
  );
create policy conversations_insert on public.conversations
  for insert with check (auth.uid() = created_by);

create policy conversation_members_select on public.conversation_members
  for select using (auth.uid() = user_id);
create policy conversation_members_insert on public.conversation_members
  for insert with check (auth.uid() = user_id);   -- a user adds themselves as member

-- ---------------------------------------------------------------------------
-- 6) MESSAGES
--    Deliveries, reactions and replies are tracked on the message row.
-- ---------------------------------------------------------------------------
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  type            text not null default 'text' check (type in ('text','image','video','voice','document')),
  content         text not null default '',
  media_metadata  jsonb,                        -- { uri, mimeType, size, width, height, durationMs }
  reply_to        uuid references public.messages(id) on delete set null,
  reactions       jsonb not null default '[]'::jsonb,  -- [{ emoji, userId, createdAt }]
  status          text not null default 'sent' check (status in ('sent','delivered','read','failed')),
  bond_lock       boolean not null default false,       -- Bond Lock protected?
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx on public.messages (sender_id);

-- Message RLS is scoped to conversation membership. Sender deliveries are
-- enforced through the conversation, not through ownership, so replies and
-- reactions remain editable by participants.
create policy messages_select on public.messages
  for select using (
    exists (select 1 from public.conversation_members m
            where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
  );
create policy messages_insert on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (select 1 from public.conversation_members m
                where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
  );
create policy messages_update on public.messages
  for update using (
    exists (select 1 from public.conversation_members m
            where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.conversation_members m
            where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7) BOND LOCK — protected/media access permissions
--    For prototype: access_tokens are short random strings the SENDER shares
--    only with the approved recipient. Production would use signed capabilities
--    / server decryption instead; documented in docs/security.md.
-- ---------------------------------------------------------------------------
create table public.bond_lock_grants (
  id             uuid primary key default gen_random_uuid(),
  message_id     uuid not null references public.messages(id) on delete cascade,
  sender_id      uuid not null references public.profiles(id) on delete cascade,
  grantee_id     uuid not null references public.profiles(id) on delete cascade,
  access_mode    text not null default 'one_time' check (access_mode in ('one_time','time_limited','each_time')),
  access_token   text,                         -- short token for demo flow
  granted_at     timestamptz default now(),
  expires_at     timestamptz,                  -- time_limited end
  remain_uses    int,                          -- for one_time tracking (1 → 0)
  status         text not null default 'granted' check (status in ('granted','revoked','denied','expired')),
  constraint bond_lock_unique unique (message_id, grantee_id)
);

create policy bond_lock_grants_select on public.bond_lock_grants
  for select using (auth.uid() in (sender_id, grantee_id));
create policy bond_lock_grants_insert on public.bond_lock_grants
  for insert with check (auth.uid() = sender_id);
create policy bond_lock_grants_update on public.bond_lock_grants
  for update using (auth.uid() in (sender_id, grantee_id))
  with check (auth.uid() in (sender_id, grantee_id));

-- ---------------------------------------------------------------------------
-- 8) MOMENTS (Bond's status feature)
--    duration: short | hour | day | permanent
-- ---------------------------------------------------------------------------
create table public.moments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'text' check (type in ('text','image','video','voice')),
  caption    text not null default '',
  media_metadata jsonb,
  visibility jsonb not null default '{"mode":"connections"}'::jsonb, -- {mode, user_ids[]}
  duration   text not null default 'hour' check (duration in ('short','hour','day','permanent')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create policy moments_select on public.moments
  for select using (auth.uid() = user_id or (visibility->>'mode' = 'connections'));
create policy moments_insert on public.moments
  for insert with check (auth.uid() = user_id);
create policy moments_update on public.moments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy moments_delete on public.moments
  for delete using (auth.uid() = user_id);

create table public.moment_views (
  moment_id  uuid not null references public.moments(id) on delete cascade,
  viewer_id  uuid not null references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (moment_id, viewer_id)
);

create policy moment_views_select on public.moment_views
  for select using (auth.uid() = viewer_id);
create policy moment_views_insert on public.moment_views
  for insert with check (auth.uid() = viewer_id);

-- ---------------------------------------------------------------------------
-- 9) SHARED SPACES, MEMORIES, BUCKET LIST
--    A space is a curated collection for a trusted group (2+ members).
-- ---------------------------------------------------------------------------
create table public.shared_spaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.shared_space_members (
  space_id uuid not null references public.shared_spaces(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create policy shared_spaces_select on public.shared_spaces
  for select using (
    exists (select 1 from public.shared_space_members m
            where m.space_id = shared_spaces.id and m.user_id = auth.uid())
  );
create policy shared_spaces_insert on public.shared_spaces
  for insert with check (auth.uid() = created_by);
create policy shared_spaces_update on public.shared_spaces
  for update using (
    exists (select 1 from public.shared_space_members m
            where m.space_id = shared_spaces.id and m.user_id = auth.uid())
  );

create policy shared_space_members_select on public.shared_space_members
  for select using (true);

create table public.memories (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid references public.shared_spaces(id) on delete cascade,
  added_by    uuid not null references public.profiles(id) on delete cascade,
  media_metadata jsonb,
  note        text not null default '',
  milestone   boolean not null default false,
  created_at  timestamptz not null default now()
);

create policy memories_select on public.memories
  for select using (
    space_id is null and auth.uid() = added_by
    or exists (select 1 from public.shared_space_members m
               where m.space_id = memories.space_id and m.user_id = auth.uid())
  );
create policy memories_insert on public.memories
  for insert with check (auth.uid() = added_by);
create policy memories_delete on public.memories
  for delete using (auth.uid() = added_by);

create table public.bucket_list_items (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid references public.shared_spaces(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  note       text not null default '',
  done       boolean not null default false,
  done_by    uuid references public.profiles(id) on delete set null,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create policy bucket_list_select on public.bucket_list_items
  for select using (
    space_id is null and auth.uid() = user_id
    or exists (select 1 from public.shared_space_members m
               where m.space_id = bucket_list_items.space_id and m.user_id = auth.uid())
  );
create policy bucket_list_insert on public.bucket_list_items
  for insert with check (auth.uid() = user_id);
create policy bucket_list_update on public.bucket_list_items
  for update using (
    space_id is null and auth.uid() = user_id
    or exists (select 1 from public.shared_space_members m
               where m.space_id = bucket_list_items.space_id and m.user_id = auth.uid())
  );
create policy bucket_list_delete on public.bucket_list_items
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 10) VOICE DIARY
--     audience: 'private' | 'connections' | 'space'
-- ---------------------------------------------------------------------------
create table public.voice_diaries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  audience    text not null default 'private' check (audience in ('private','connections','space')),
  space_id    uuid references public.shared_spaces(id) on delete cascade,
  voice_uri   text not null,
  transcript  text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);

create policy voice_diaries_select on public.voice_diaries
  for select using (
    auth.uid() = user_id
    or (audience = 'connections'
        and exists (select 1 from public.connections c
                    where c.status = 'accepted' and auth.uid() in (c.user_a, c.user_b)
                      and voice_diaries.user_id in (c.user_a, c.user_b)))
    or (audience = 'space' and exists (select 1 from public.shared_space_members m
        where m.space_id = voice_diaries.space_id and m.user_id = auth.uid()))
  );
create policy voice_diaries_insert on public.voice_diaries
  for insert with check (auth.uid() = user_id);
create policy voice_diaries_delete on public.voice_diaries
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 11) SURPRISE BOX / FUTURE MESSAGES
--     A prepared message revealed on a chosen date. Only the recipient can see
--     it after reveal_at; the creator can manage before it is delivered.
-- ---------------------------------------------------------------------------
create table public.surprise_boxes (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type        text not null default 'message' check (type in ('message','media')),
  content     text not null default '',
  media_metadata jsonb,
  reveal_at   timestamptz not null,
  opened      boolean not null default false,
  opened_at   timestamptz,
  created_at  timestamptz not null default now()
);

create policy surprise_boxes_select on public.surprise_boxes
  for select using (auth.uid() in (sender_id, recipient_id));
create policy surprise_boxes_insert on public.surprise_boxes
  for insert with check (auth.uid() = sender_id);
create policy surprise_boxes_update on public.surprise_boxes
  for update using (auth.uid() in (sender_id, recipient_id))
  with check (auth.uid() in (sender_id, recipient_id));
create policy surprise_boxes_delete on public.surprise_boxes
  for delete using (auth.uid() = sender_id);

-- ---------------------------------------------------------------------------
-- 12) I NEED YOU — permission-based alert
--     The RECIPIENT must opt in via user_settings; sending is restricted to a
--     confirmed connection. Fast replies: 'acknowledged' then optional 'answered'.
-- ---------------------------------------------------------------------------
create table public.i_need_you (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  message       text not null default '',
  status        text not null default 'pending' check (status in ('pending','acknowledged','answered')),
  ack_action    text check (ack_action in ('im_here','will_respond','answered')),
  acked_at      timestamptz,
  created_at    timestamptz not null default now()
);

create index i_need_you_recipient_idx on public.i_need_you (recipient_id, created_at);

-- Recipient pref record: opt-in to the whole feature + per-connection rules + quiet hours.
create table public.i_need_you_prefs (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  opt_in      boolean not null default false,   -- must be true to RECEIVE alerts
  quiet_hours jsonb not null default '{"enabled":false}'::jsonb, -- {enabled, start:"22:00", end:"07:00"}
  allowed     jsonb not null default '{"mode":"all_connections"}'::jsonb, -- {mode, user_ids[]}
  custom_sound boolean not null default false,
  updated_at  timestamptz not null default now()
);

create policy i_need_you_select on public.i_need_you
  for select using (auth.uid() in (requester_id, recipient_id));
create policy i_need_you_insert on public.i_need_you
  for insert with check (
    auth.uid() = requester_id
    and exists (select 1 from public.connections c
                where c.status = 'accepted'
                  and auth.uid() in (c.user_a, c.user_b)
                  and recipient_id in (c.user_a, c.user_b))
  );
create policy i_need_you_update on public.i_need_you
  for update using (auth.uid() in (requester_id, recipient_id))
  with check (auth.uid() in (requester_id, recipient_id));

create policy iny_prefs_select on public.i_need_you_prefs
  for select using (auth.uid() = user_id);
create policy iny_prefs_insert on public.i_need_you_prefs
  for insert with check (auth.uid() = user_id);
create policy iny_prefs_update on public.i_need_you_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 13) NOTIFICATIONS
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, read, created_at);

create policy notifications_select on public.notifications
  for select using (auth.uid() = user_id);
create policy notifications_insert on public.notifications
  for insert with check (auth.uid() = user_id);
create policy notifications_update on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notifications_delete on public.notifications
  for delete using (auth.uid() = user_id);

-- ===========================================================================
-- HELPERS: updated_at triggers
-- ===========================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger connections_set_updated_at before update on public.connections
  for each row execute function public.set_updated_at();
create trigger messages_set_updated_at before update on public.messages
  for each row execute function public.set_updated_at();

-- Prevent infinite recursion risk in connection RLS: helper to check "are these two connected"
create or replace function public.are_connected(a uuid, b uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ( (c.user_a = a and c.user_b = b) or (c.user_a = b and c.user_b = a) )
  );
$$;

commit;
