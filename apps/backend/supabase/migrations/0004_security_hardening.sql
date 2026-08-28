-- =============================================================================
-- Bond — Migration 0004: security hardening
-- -----------------------------------------------------------------------------
-- Resolves the RLS gaps found in the security audit:
--   * `connections`: inserts may only create *pending* requests.
--   * `moments`: `visibility='connections'` now requires a real accepted
--     connection (previously readable by every authenticated user).
--   * `shared_space_members`: proper membership-gated select + insert/update/
--     delete policies (previously read-all + no writes at all).
--   * `conversation_members`: membership-scoped select + insert of the peer,
--     plus own-row update/delete (previously unreadable/broken).
--   * `messages`: content/identity fields are immutable; peers may only update
--     delivery state (status/reactions) via a guard trigger.
--   * `bond_lock_grants`: only the sender can update a grant — recipients consume
--     access through the `unlock_bond_grant` RPC instead (migration 0006).
--   * `memories` / `bucket_list_items`: inserts require space membership.
--   * `i_need_you`: opt-in, per-connection allowed list and quiet hours are now
--     enforced server-side (previously client-side only).
--   * `profiles`: adds `last_active_at` for the presence / "heartbeat" feature.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Presence: lightweight, server-visible "active now" signal.
-- Gated by nothing special: it is a coarse online indicator surfaced to
-- connections; it does not expose any PII beyond last-activity time.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column last_active_at timestamptz;

-- ---------------------------------------------------------------------------
-- Auth hardening: profile bootstrap must never break signup on a duplicate
-- bond_id or a concurrent signup race (ON CONFLICT DO NOTHING).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, bond_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(new.raw_user_meta_data->>'bond_id',
             'bond_' || substr(replace(new.id::text, '-', ''), 1, 10))
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Helper: can a moment be viewed by the current user?
-- Owner always; connections mode requires an accepted connection and a live
-- expiry window; selected mode requires the user id in visibility.user_ids.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_moment(m public.moments)
returns boolean language sql stable as $$
  select
    auth.uid() = m.user_id
    or (
      m.visibility->>'mode' = 'connections'
      and (m.expires_at is null or m.expires_at > now())
      and exists (
        select 1 from public.connections c
        where c.status = 'accepted'
          and ((c.user_a = auth.uid() and c.user_b = m.user_id)
            or (c.user_a = m.user_id and c.user_b = auth.uid()))
      )
    )
    or (
      m.visibility->>'mode' = 'selected'
      and (m.expires_at is null or m.expires_at > now())
      and coalesce(m.visibility->'user_ids', '[]'::jsonb) ? auth.uid()::text
    );
$$;

-- ---------------------------------------------------------------------------
-- Helper: is `now` inside the JSON quiet-hours window { enabled, start, end }
-- with "HH:MM" 24h strings. A window that crosses midnight (start > end)
-- wraps. Times are interpreted in the server's UTC timezone — documented
-- approximation for the free tier.
-- ---------------------------------------------------------------------------
create or replace function public.now_in_quiet_hours(q jsonb)
returns boolean language sql stable as $$
  select
    coalesce((q->>'enabled')::boolean, false)
    and q->>'start' is not null
    and q->>'end' is not null
    and (
      with t as (
        select q->>'start' as s, q->>'end' as e, to_char(now(), 'HH24:MI') as n
      )
      select case
        when s <= e then n >= s and n <= e
        else n >= s or  n <= e
      end
      from t
    );
$$;

-- ---------------------------------------------------------------------------
-- Helper: may `requester` raise an I Need You alert to `recipient`?
-- Requires: not blocked, an accepted connection, recipient opt-in, recipient's
-- allowed-list (mode != all_connections must include the requester), and quiet
-- hours not active. A self-alert is always allowed (personal notebook).
-- ---------------------------------------------------------------------------
create or replace function public.can_alert(requester uuid, recipient uuid)
returns boolean language sql stable as $$
  select
    requester = recipient
    or (
      exists (
        select 1 from public.connections c
        where c.status = 'accepted'
          and ((c.user_a = requester and c.user_b = recipient)
            or (c.user_a = recipient and c.user_b = requester))
      )
      and coalesce((select opt_in from public.i_need_you_prefs where user_id = recipient), false)
      and (
        select
          case
            when nullif(allowed->>'mode', '') is null then true
            when (allowed->>'mode') = 'all_connections' then true
            else coalesce(allowed->'user_ids', '[]'::jsonb) ? requester::text
          end
        from public.i_need_you_prefs where user_id = recipient
      )
      and not public.now_in_quiet_hours(
        coalesce((select quiet_hours from public.i_need_you_prefs where user_id = recipient), '{"enabled":false}'::jsonb)
      )
    )
$$;

-- ---------------------------------------------------------------------------
-- 1) CONNECTIONS — only *pending* requests may be created, and the requester
--    must identify themselves. No more forcing `status='accepted'`.
-- ---------------------------------------------------------------------------
drop policy if exists connections_insert on public.connections;
create policy connections_insert on public.connections
  for insert with check (
    auth.uid() in (user_a, user_b)
    and status = 'pending'
    and requested_by = auth.uid()
  );

-- Restore referential integrity for the requester columns (missing FKs).
alter table public.connections
  drop constraint if exists connections_requested_by_fkey;
alter table public.connections
  add constraint connections_requested_by_fkey
  foreign key (requested_by) references public.profiles(id) on delete set null;
alter table public.connections
  drop constraint if exists connections_invited_by_fkey;
alter table public.connections
  add constraint connections_invited_by_fkey
  foreign key (invited_by) references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2) MOMENTS — visibility enforced through connections / selected list.
-- ---------------------------------------------------------------------------
drop policy if exists moments_select on public.moments;
create policy moments_select on public.moments
  for select using (public.can_view_moment(moments));

-- Moment owners may see who viewed their moments (needed for the view count).
drop policy if exists moment_views_select on public.moment_views;
create policy moment_views_select on public.moment_views
  for select using (
    auth.uid() = viewer_id
    or exists (select 1 from public.moments m
               where m.id = moment_views.moment_id and m.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3) CONVERSATION MEMBERS — fix read, peer insert, read receipts, cleanup.
-- ---------------------------------------------------------------------------
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select on public.conversation_members
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.conversation_members self
               where self.conversation_id = conversation_members.conversation_id
                 and self.user_id = auth.uid())
  );

drop policy if exists conversation_members_insert on public.conversation_members;
create policy conversation_members_insert on public.conversation_members
  for insert with check (
    auth.uid() = user_id
    or exists (select 1 from public.conversation_members self
               where self.conversation_id = conversation_members.conversation_id
                 and self.user_id = auth.uid())
    or exists (select 1 from public.conversations c
               where c.id = conversation_members.conversation_id
                 and c.created_by = auth.uid())
  );

drop policy if exists conversation_members_update on public.conversation_members;
create policy conversation_members_update on public.conversation_members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists conversation_members_delete on public.conversation_members;
create policy conversation_members_delete on public.conversation_members
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4) MESSAGES — peers may update delivery state only; content/identity fields
--    are protected by a guard trigger.
-- ---------------------------------------------------------------------------
create or replace function public.guard_message_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sender_id <> old.sender_id
     or new.conversation_id <> old.conversation_id
     or new.type <> old.type
     or new.content <> old.content
     or new.bond_lock <> old.bond_lock
     or new.media_metadata is distinct from old.media_metadata
     or new.reply_to is distinct from old.reply_to
  then
    raise exception 'messages: identity and content fields are immutable';
  end if;
  return new;
end $$;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
  before update of sender_id, conversation_id, type, content, bond_lock, media_metadata, reply_to
  on public.messages
  for each row execute function public.guard_message_update();

-- ---------------------------------------------------------------------------
-- 5) BOND LOCK GRANTS — only the sender mutates a grant directly. Recipients
--    consume access exclusively through `unlock_bond_grant` (migration 0006),
--    which re-checks status/expiry and atomically decrements uses.
-- ---------------------------------------------------------------------------
drop policy if exists bond_lock_grants_update on public.bond_lock_grants;
create policy bond_lock_grants_update on public.bond_lock_grants
  for update using (auth.uid() = sender_id) with check (auth.uid() = sender_id);

-- ---------------------------------------------------------------------------
-- 6) SHARED SPACES + MEMBERS — membership-gated reads; creator manages people.
-- ---------------------------------------------------------------------------
drop policy if exists shared_space_members_select on public.shared_space_members;
create policy shared_space_members_select on public.shared_space_members
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.shared_space_members self
               where self.space_id = shared_space_members.space_id
                 and self.user_id = auth.uid())
  );

drop policy if exists shared_space_members_insert on public.shared_space_members;
create policy shared_space_members_insert on public.shared_space_members
  for insert with check (
    auth.uid() = user_id
    or exists (select 1 from public.shared_spaces s
               where s.id = shared_space_members.space_id and s.created_by = auth.uid())
  );

drop policy if exists shared_space_members_update on public.shared_space_members;
create policy shared_space_members_update on public.shared_space_members
  for update using (
    auth.uid() = user_id
    or exists (select 1 from public.shared_spaces s
               where s.id = shared_space_members.space_id and s.created_by = auth.uid())
  );

drop policy if exists shared_space_members_delete on public.shared_space_members;
create policy shared_space_members_delete on public.shared_space_members
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.shared_spaces s
               where s.id = shared_space_members.space_id and s.created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7) MEMORIES + BUCKET LIST — inserts must be scoped to a space the user
--    belongs to (personal rows stay allowed).
-- ---------------------------------------------------------------------------
drop policy if exists memories_insert on public.memories;
create policy memories_insert on public.memories
  for insert with check (
    auth.uid() = added_by
    and (space_id is null
         or exists (select 1 from public.shared_space_members m
                    where m.space_id = memories.space_id and m.user_id = auth.uid()))
  );

drop policy if exists bucket_list_insert on public.bucket_list_items;
create policy bucket_list_insert on public.bucket_list_items
  for insert with check (
    auth.uid() = user_id
    and (space_id is null
         or exists (select 1 from public.shared_space_members m
                    where m.space_id = bucket_list_items.space_id and m.user_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 8) I NEED YOU — server-enforced permission model via can_alert().
-- ---------------------------------------------------------------------------
drop policy if exists i_need_you_insert on public.i_need_you;
create policy i_need_you_insert on public.i_need_you
  for insert with check (
    auth.uid() = requester_id
    and public.can_alert(requester_id, recipient_id)
  );

-- ---------------------------------------------------------------------------
-- Performance indexes discovered by the audit.
-- ---------------------------------------------------------------------------
create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id);
create index if not exists memories_space_idx
  on public.memories (space_id);
create index if not exists bucket_list_space_idx
  on public.bucket_list_items (space_id);
create index if not exists bond_lock_grants_active_idx
  on public.bond_lock_grants (grantee_id, status);
create index if not exists media_message_idx
  on public.media (message_id);
create index if not exists media_moment_idx
  on public.media (moment_id);

commit;