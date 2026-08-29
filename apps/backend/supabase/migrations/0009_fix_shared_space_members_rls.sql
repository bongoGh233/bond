-- Apply the same membership-helper pattern to shared spaces (mirrors 0008).
-- shared_space_members_select self-referenced its own table, which recursed
-- whenever any subquery (shared_spaces, memories, bucket_list, voice_diaries)
-- looked up membership under RLS.

create or replace function public.is_shared_space_member(
  p_space_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.shared_space_members m
    where m.space_id = p_space_id and m.user_id = p_user_id
  );
$$;

revoke all on function public.is_shared_space_member(uuid, uuid) from public;
grant execute on function public.is_shared_space_member(uuid, uuid) to authenticated;

drop policy if exists shared_space_members_select on public.shared_space_members;
create policy shared_space_members_select on public.shared_space_members
  for select using (
    auth.uid() = user_id
    or public.is_shared_space_member(shared_space_members.space_id, auth.uid())
  );