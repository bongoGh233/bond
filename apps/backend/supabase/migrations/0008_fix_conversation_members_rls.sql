-- Fix: conversation_members RLX policies that self-reference conversation_members
-- caused "infinite recursion detected in policy for relation conversation_members".
--
-- The select/insert policies need to check "is this user a member of the same
-- conversation" to let peers render each other's membership rows. Doing that with
-- a self-JOIN inside the policy recurses. We delegate the check to a SECURITY
-- DEFINER helper (owned by postgres) that bypasses RLS and only returns a boolean,
-- so no policy ever scans its own table directly.

create or replace function public.is_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation_id and m.user_id = p_user_id
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select on public.conversation_members
  for select using (
    auth.uid() = user_id
    or public.is_conversation_member(conversation_members.conversation_id, auth.uid())
  );

drop policy if exists conversation_members_insert on public.conversation_members;
create policy conversation_members_insert on public.conversation_members
  for insert with check (
    auth.uid() = user_id
    or public.is_conversation_member(conversation_members.conversation_id, auth.uid())
    or exists (select 1 from public.conversations c
               where c.id = conversation_members.conversation_id
                 and c.created_by = auth.uid())
  );