-- Fix get_or_create_conversation volatility: it performs INSERTs, so it must be
-- VOLATILE (default), not STABLE. Marking it stable caused PostgREST to reject
-- calls with "INSERT is not allowed in a non-volatile function". Recreate it.

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