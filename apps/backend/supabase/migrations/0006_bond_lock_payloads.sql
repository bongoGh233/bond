-- =============================================================================
-- Bond — Migration 0006: server-enforced Bond Lock
-- -----------------------------------------------------------------------------
-- Replaces the "token is decorative" prototype with a capability model:
--   * The real content lives in `bond_lock_payloads`, which has NO SELECT
--     policy — not even conversation members can read it through SQL.
--   * `create_bond_lock()` — SECURITY DEFINER entry point that atomically
--     creates the marker message, the hidden payload, and the grant with a
--     server-generated token.
--   * `unlock_bond_grant()` — the ONLY way to read a payload. Re-checks status,
--     expiry and remaining uses, decrements one_time use atomically, auto-marks
--     expired grants, then returns the content.
--   * `revoke_bond_lock()` — sender-side revoke.
-- No homemade encryption is involved. Enforcement is server-side authorization:
-- content is unguessable, unreadable except through an authorized unlock, and
-- the grants are the only capability.
-- =============================================================================

begin;

-- The hidden payload container. No SELECT policy => nobody can read content
-- through normal SQL/RLS. Reads happen only inside `unlock_bond_grant`.
create table public.bond_lock_payloads (
  id             uuid primary key default gen_random_uuid(),
  message_id     uuid not null unique references public.messages(id) on delete cascade,
  kind           text not null default 'text' check (kind in ('text','media')),
  content        text not null default '',
  media_metadata jsonb,
  created_at     timestamptz not null default now()
);

alter table public.bond_lock_payloads enable row level security;

-- Only the sender of the linked message may write the payload.
create policy bond_lock_payloads_insert on public.bond_lock_payloads
  for insert with check (
    auth.uid() = (select sender_id from public.messages m where m.id = bond_lock_payloads.message_id)
  );

-- Atomic sender-side creation of a Bond Lock (message + payload + grant).
create or replace function public.create_bond_lock(
  p_conversation_id uuid,
  p_grantee_id uuid,
  p_content text,
  p_access_mode text,
  p_expires_at timestamptz default null,
  p_remain_uses int default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_message_id uuid;
  v_grant jsonb;
begin
  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = auth.uid()
  ) then
    raise exception 'not a member of this conversation';
  end if;

  if not exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.user_a = auth.uid() and c.user_b = p_grantee_id)
        or (c.user_a = p_grantee_id and c.user_b = auth.uid()))
  ) then
    raise exception 'grantee must be an accepted connection';
  end if;

  if p_access_mode not in ('one_time', 'time_limited', 'each_time') then
    raise exception 'invalid access mode';
  end if;

  if lower(p_access_mode) = 'time_limited' and (p_expires_at is null or p_expires_at <= now()) then
    raise exception 'time-limited access requires a future expires_at';
  end if;

  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'content is required';
  end if;

  insert into public.messages (conversation_id, sender_id, type, content, bond_lock)
  values (p_conversation_id, auth.uid(), 'text', '', true)
  returning id into v_message_id;

  insert into public.bond_lock_payloads (message_id, kind, content)
  values (v_message_id, 'text', p_content);

  insert into public.bond_lock_grants (
    message_id, sender_id, grantee_id, access_mode, access_token,
    expires_at, remain_uses, status
  )
  values (
    v_message_id, auth.uid(), p_grantee_id, p_access_mode,
    'BOND-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
    p_expires_at,
    case when p_access_mode = 'one_time' then coalesce(p_remain_uses, 1) else p_remain_uses end,
    'granted'
  )
  returning jsonb_build_object('grant_id', id, 'token', access_token) into v_grant;

  return jsonb_build_object(
    'grant_id', v_grant->>'grant_id',
    'access_token', v_grant->>'token',
    'message_id', v_message_id
  );
end $$;

-- The ONLY way a grantee reads protected content. Server re-validates state.
create or replace function public.unlock_bond_grant(p_grant_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_grant record;
  v_payload record;
  v_remaining int;
begin
  select * into v_grant from public.bond_lock_grants g where g.id = p_grant_id;
  if not found then
    raise exception 'grant not found';
  end if;
  if v_grant.grantee_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if v_grant.status = 'revoked' or v_grant.status = 'denied' then
    raise exception 'access revoked by sender';
  end if;

  -- Expiry is always authoritative for time_limited grants.
  if v_grant.access_mode = 'time_limited' and v_grant.expires_at is not null and v_grant.expires_at < now() then
    update public.bond_lock_grants set status = 'expired' where id = v_grant.id;
    raise exception 'access expired';
  end if;

  if v_grant.access_mode = 'one_time' then
    if v_grant.remain_uses is null or v_grant.remain_uses <= 0 then
      update public.bond_lock_grants set status = 'expired' where id = v_grant.id;
      raise exception 'access used up';
    end if;
    update public.bond_lock_grants g
    set remain_uses = g.remain_uses - 1,
        status = case when g.remain_uses - 1 <= 0 then 'expired' else g.status end
    where g.id = v_grant.id
    returning remain_uses into v_remaining;
  else
    select remain_uses into v_remaining from public.bond_lock_grants g where g.id = v_grant.id;
  end if;

  select * into v_payload from public.bond_lock_payloads p where p.message_id = v_grant.message_id;
  if not found then
    raise exception 'payload missing';
  end if;

  return jsonb_build_object(
    'message_id', v_grant.message_id,
    'sender_id', v_grant.sender_id,
    'access_mode', v_grant.access_mode,
    'remain_uses', v_remaining,
    'kind', v_payload.kind,
    'content', v_payload.content,
    'media_metadata', v_payload.media_metadata
  );
end $$;

-- Sender-side revoke.
create or replace function public.revoke_bond_lock(p_grant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bond_lock_grants set status = 'revoked'
  where id = p_grant_id and sender_id = auth.uid();
  if not found then
    raise exception 'not authorized or grant not found';
  end if;
end $$;

create index if not exists bond_lock_grants_grantee_status_idx
  on public.bond_lock_grants (grantee_id, status, expires_at);

commit;