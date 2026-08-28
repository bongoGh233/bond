-- =============================================================================
-- Bond — Migration 0005: real notification pipeline + media authorization
-- -----------------------------------------------------------------------------
-- * Database triggers now write in-app `notifications` for real events
--   (I Need You, messages incl. Bond Lock, surprise boxes, connections,
--   moment views). Previously the table had no writer and was always empty.
-- * `media` registry gains a `voice_diary_id` link.
-- * Storage read authorization is centralized in a SECURITY DEFINER helper
--   that checks conversation membership, moment visibility, or voice-diary
--   audience — fixing the old policy that (a) ignored moments and voice
--   diaries and (b) was itself blocked by `media` RLS in policy evaluation.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Notification writer helper (SECURITY DEFINER: the database writes to the
-- receiving user's notification rows; clients can never do this directly).
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(p_user_id uuid, p_type text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, payload)
  values (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb));
end $$;

-- --- I Need You --------------------------------------------------------------
create or replace function public.notify_on_i_need_you()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.recipient_id <> new.requester_id then
    perform public.notify_user(
      new.recipient_id,
      'i_need_you',
      jsonb_build_object('alert_id', new.id, 'requester_id', new.requester_id, 'message', new.message)
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_i_need_you_ai on public.i_need_you;
create trigger notify_i_need_you_ai
  after insert on public.i_need_you
  for each row execute function public.notify_on_i_need_you();

create or replace function public.notify_on_i_need_you_ack()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status in ('acknowledged', 'answered') then
    perform public.notify_user(
      new.requester_id,
      'i_need_you_ack',
      jsonb_build_object('alert_id', new.id, 'recipient_id', new.recipient_id, 'ack_action', new.ack_action)
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_i_need_you_ack on public.i_need_you;
create trigger notify_i_need_you_ack
  after update of status on public.i_need_you
  for each row when (old.status = 'pending' and new.status in ('acknowledged', 'answered'))
  execute function public.notify_on_i_need_you_ack();

-- --- Messages (with Bond Lock privacy) ---------------------------------------
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.bond_lock then
    -- Recipients are told a lock arrived, but never see content server-side
    -- until they unlock via `unlock_bond_grant`.
    insert into public.notifications (user_id, type, payload)
    select m.user_id, 'bond_lock',
           jsonb_build_object('message_id', new.id, 'conversation_id', new.conversation_id, 'sender_id', new.sender_id)
    from public.conversation_members m
    where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id;
  else
    insert into public.notifications (user_id, type, payload)
    select m.user_id, 'message',
           jsonb_build_object('message_id', new.id, 'conversation_id', new.conversation_id,
                              'sender_id', new.sender_id, 'content', left(new.content, 160))
    from public.conversation_members m
    where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id;
  end if;
  return new;
end $$;

drop trigger if exists notify_message_ai on public.messages;
create trigger notify_message_ai
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- --- Surprise box ------------------------------------------------------------
create or replace function public.notify_on_surprise_box()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.recipient_id <> new.sender_id then
    perform public.notify_user(
      new.recipient_id,
      'surprise',
      jsonb_build_object('surprise_id', new.id, 'sender_id', new.sender_id, 'reveal_at', new.reveal_at)
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_surprise_ai on public.surprise_boxes;
create trigger notify_surprise_ai
  after insert on public.surprise_boxes
  for each row execute function public.notify_on_surprise_box();

create or replace function public.notify_on_surprise_opened()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.opened and not old.opened then
    perform public.notify_user(
      new.sender_id,
      'surprise_opened',
      jsonb_build_object('surprise_id', new.id, 'recipient_id', new.recipient_id)
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_surprise_opened on public.surprise_boxes;
create trigger notify_surprise_opened
  after update of opened on public.surprise_boxes
  for each row when (new.opened and not old.opened)
  execute function public.notify_on_surprise_opened();

-- --- Connections --------------------------------------------------------------
create or replace function public.notify_on_connection_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_other uuid;
begin
  if new.status <> 'pending' then return new; end if;
  v_other := case when new.user_a = new.requested_by then new.user_b else new.user_a end;
  if v_other <> new.requested_by then
    perform public.notify_user(
      v_other,
      'connection_request',
      jsonb_build_object('connection_id', new.id, 'requester_id', new.requested_by)
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_connection_request on public.connections;
create trigger notify_connection_request
  after insert on public.connections
  for each row execute function public.notify_on_connection_request();

create or replace function public.notify_on_connection_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_acceptor uuid;
begin
  if old.status = 'pending' and new.status = 'accepted' then
    -- The acceptor is whichever member is NOT the original requester
    -- (requested_by can be user_a or user_b).
    v_acceptor := case when new.user_a = new.requested_by then new.user_b else new.user_a end;
    perform public.notify_user(
      new.requested_by,
      'connection_accepted',
      jsonb_build_object('connection_id', new.id, 'acceptor_id', v_acceptor)
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_connection_accepted on public.connections;
create trigger notify_connection_accepted
  after update of status on public.connections
  for each row when (old.status = 'pending' and new.status = 'accepted')
  execute function public.notify_on_connection_accepted();

-- --- Moment views -------------------------------------------------------------
create or replace function public.notify_on_moment_view()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.moments where id = new.moment_id;
  if v_owner is not null and v_owner <> new.viewer_id then
    perform public.notify_user(
      v_owner,
      'moment_view',
      jsonb_build_object('moment_id', new.moment_id, 'viewer_id', new.viewer_id)
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_moment_view on public.moment_views;
create trigger notify_moment_view
  after insert on public.moment_views
  for each row execute function public.notify_on_moment_view();

-- ---------------------------------------------------------------------------
-- Media registry: voice diary link
-- ---------------------------------------------------------------------------
alter table public.media
  add column voice_diary_id uuid references public.voice_diaries(id) on delete set null;

create index if not exists media_voice_diary_idx
  on public.media (voice_diary_id);

-- ---------------------------------------------------------------------------
-- Storage read authorization (SECURITY DEFINER).
-- Centralizes every object-access rule in one place instead of a policy
-- subquery that would itself be filtered by `media` RLS.
-- ---------------------------------------------------------------------------
create or replace function public.storage_can_read_object(p_object_name text)
returns boolean language plpgsql security definer set search_path = public stable as $$
declare
  v_owner uuid;
  v_message_id uuid;
  v_moment_id uuid;
  v_voice_diary_id uuid;
begin
  select m.owner_id, m.message_id, m.moment_id, m.voice_diary_id
    into v_owner, v_message_id, v_moment_id, v_voice_diary_id
  from public.media m
  where m.object_name = p_object_name;
  if not found then
    return false;
  end if;

  if auth.uid() = v_owner then
    return true;
  end if;

  if v_message_id is not null then
    return exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = v_message_id and cm.user_id = auth.uid()
    );
  end if;

  if v_moment_id is not null then
    return exists (
      select 1 from public.moments mo
      where mo.id = v_moment_id and public.can_view_moment(mo)
    );
  end if;

  if v_voice_diary_id is not null then
    return exists (
      select 1 from public.voice_diaries v
      where v.id = v_voice_diary_id
        and (
          v.user_id = auth.uid()
          or (v.audience = 'connections' and public.are_connected(auth.uid(), v.user_id))
          or (v.audience = 'space' and exists (
                select 1 from public.shared_space_members m2
                where m2.space_id = v.space_id and m2.user_id = auth.uid()))
        )
    );
  end if;

  return false;
end $$;

-- Replace the read policy with the helper-backed version.
drop policy if exists "media_read_via_registry" on storage.objects;
create policy "media_read_via_registry" on storage.objects
  for select using (
    bucket_id = 'bond-media'
    and public.storage_can_read_object(name)
  );

-- ---------------------------------------------------------------------------
-- Realtime: surface events the apps now subscribe to live.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.surprise_boxes;
alter publication supabase_realtime add table public.voice_diaries;

commit;