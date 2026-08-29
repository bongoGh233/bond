-- Add a get_or_create_conversation RPC.
--
-- Why: the prior client flow inserted a row into `conversations` and then re-read
-- it with `.select().single()`. PostgREST's INSERT ... RETURNING re-applies the
-- SELECT policy to the returned row in the same statement; because the creator is
-- not yet a row in `conversation_members`, the `conversations_select` policy
-- (membership-gated) denies the row, surfacing as
--   "new row violates row-level security policy for table conversations".
--
-- This function runs as SECURITY DEFINER (bypasses RLS), so it can insert the
-- conversation and both membership rows atomically and return the id. The caller
-- has no access to the raw table writes and cannot read anything they are not a
-- member of. Callers must be authenticated (revoked from anon).

create or replace function public.get_or_create_conversation(p_user_id uuid, p_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_conversation_id uuid;
begin
  select m.conversation_id into v_conversation_id
  from public.conversation_members m
  join public.conversation_members o
    on o.conversation_id = m.conversation_id
   and o.user_id = p_other_id
  where m.user_id = p_user_id
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (is_group, title, created_by)
  values (false, null, p_user_id)
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation_id, p_user_id),
         (v_conversation_id, p_other_id);

  return v_conversation_id;
end $$;

revoke all on function public.get_or_create_conversation(uuid, uuid) from public;
grant execute on function public.get_or_create_conversation(uuid, uuid) to authenticated;