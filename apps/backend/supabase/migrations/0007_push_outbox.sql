-- =============================================================================
-- Bond — Migration 0007: push notification delivery pipeline
-- -----------------------------------------------------------------------------
-- In-app `notifications` are surfaced via Realtime while the app is open. For
-- background delivery we enqueue pushes into a private `push_outbox` table, and
-- a server-side Edge Function (`process-push-outbox`) flushes it through the
-- Expo push service. Device tokens live only in `user_devices.token` and are
-- consumed server-side; they are never exposed to other clients.
--
-- No RLS policies are created for `push_outbox` (RLS on + zero policies),
-- so no client can read or wrote it — only the service role / Edge Function,
-- which bypasses RLS, can process rows.
--
-- Delivery rules implemented by `enqueue_push_after_notification`:
--   * only users with at least one push-enabled device get a push row;
--   * respects the user's `settings.push_notifications` opt-out;
--   * respects `settings.quiet_hours` for everything EXCEPT I Need You
--     (urgent alerts intentionally bypass quiet hours);
--   * I Need You acknowledgements notify the original requester.
-- =============================================================================

begin;

create table public.push_outbox (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  title            text not null default '',
  body             text not null default '',
  data             jsonb not null default '{}'::jsonb,
  status           text not null default 'pending'
                   check (status in ('pending','queued','sent','failed')),
  attempts         int not null default 0,
  error            text,
  next_attempt_at  timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index push_outbox_ready_idx on public.push_outbox (status, next_attempt_at);

alter table public.push_outbox enable row level security;

-- Human-readable push copy derived from a notification type + payload.
create or replace function public.push_copy(p_type text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_body text;
  v_name text;
begin
  case p_type
    when 'i_need_you' then
      select coalesce(display_name, 'A connection') into v_name
      from public.profiles where id = (p_payload->>'requester_id')::uuid;
      v_title := 'I Need You';
      v_body := v_name || ' needs you right now.';
    when 'i_need_you_ack' then
      select coalesce(display_name, 'Someone') into v_name
      from public.profiles where id = (p_payload->>'recipient_id')::uuid;
      v_title := 'They heard you';
      v_body := v_name || ' acknowledged your alert.';
    when 'message' then
      select coalesce(display_name, 'Someone') into v_name
      from public.profiles where id = (p_payload->>'sender_id')::uuid;
      v_title := v_name || ' sent you a message';
      v_body := coalesce(p_payload->>'content', '');
    when 'bond_lock' then
      select coalesce(display_name, 'Someone') into v_name
      from public.profiles where id = (p_payload->>'sender_id')::uuid;
      v_title := v_name || ' locked something for you';
      v_body := 'Unlock to reveal.';
    when 'surprise' then
      v_title := 'A surprise awaits';
      v_body := 'Your surprise box has been delivered.';
    when 'surprise_opened' then
      select coalesce(display_name, 'Someone') into v_name
      from public.profiles where id = (p_payload->>'recipient_id')::uuid;
      v_title := 'Surprise opened';
      v_body := v_name || ' opened your surprise.';
    when 'connection_request' then
      select coalesce(display_name, 'Someone') into v_name
      from public.profiles where id = (p_payload->>'requester_id')::uuid;
      v_title := 'New connection request';
      v_body := v_name || ' wants to connect with you.';
    when 'connection_accepted' then
      select coalesce(display_name, 'Someone') into v_name
      from public.profiles where id = (p_payload->>'acceptor_id')::uuid;
      v_title := 'Connection accepted';
      v_body := v_name || ' accepted your request.';
    when 'moment_view' then
      v_title := 'Moment seen';
      v_body := 'Someone viewed your moment.';
    else
      v_title := p_type;
      v_body := '';
  end case;
  return jsonb_build_object('title', v_title, 'body', v_body);
end $$;

-- Enqueue a push row whenever a real notification is created server-side.
create or replace function public.enqueue_push_after_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_push boolean;
  v_copy jsonb;
begin
  if exists (
    select 1 from public.user_devices d
    where d.user_id = new.user_id and d.token is not null
  ) then
    select coalesce((settings->>'push_notifications')::boolean, true) into v_push
    from public.user_settings where user_id = new.user_id;
    if coalesce(v_push, true) then
      if new.type <> 'i_need_you' and public.now_in_quiet_hours(coalesce(
        (select settings->'quiet_hours' from public.user_settings where user_id = new.user_id),
        '{"enabled":false}'::jsonb)) then
        return new;
      end if;
      v_copy := public.push_copy(new.type, new.payload);
      insert into public.push_outbox (user_id, notification_id, title, body, data)
      values (new.user_id, new.id, v_copy->>'title', v_copy->>'body', new.payload);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists enqueue_push_ai on public.notifications;
create trigger enqueue_push_ai
  after insert on public.notifications
  for each row execute function public.enqueue_push_after_notification();

commit;