-- =============================================================================
-- Bond — Migrations 0003: media storage + media access metadata
-- -----------------------------------------------------------------------------
-- Uploads go to the Supabase Storage bucket `bond-media` under
--   {owner_user_id}/{uuid}.{ext}
--
-- PROTOTYPE NOTE (honesty over marketing):
-- Storage-level ACLs are coarser than the row-level RLS used elsewhere. For the
-- prototype we restrict WRITES to the owner's own folder, and REGISTER every
-- object in `media` so the app can enforce access via message/conversation RLS
-- before requesting the signed URL. Production should gate signed-URL creation
-- behind a server function that checks the same membership rules. See docs/security.md.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Media registry: maps a stored object to its owning message / moment.
-- Lets us (a) know who can access it, (b) attach Bond Lock metadata.
-- ---------------------------------------------------------------------------
create table public.media (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  bucket_id     text not null default 'bond-media',
  object_name   text not null unique,     -- storage path: {owner_id}/{uuid}.{ext}
  message_id    uuid references public.messages(id) on delete set null,
  moment_id     uuid references public.moments(id) on delete set null,
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

create policy media_select on public.media
  for select using (auth.uid() = owner_id);
create policy media_insert on public.media
  for insert with check (auth.uid() = owner_id);
create policy media_delete on public.media
  for delete using (auth.uid() = owner_id);

alter table public.media enable row level security;

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bond-media', 'bond-media', false)
on conflict (id) do nothing;

-- Owner may upload into their own folder.
create policy "media_write_own_folder" on storage.objects
  for insert with check (
    bucket_id = 'bond-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners may delete objects inside their own folder.
create policy "media_delete_own_folder" on storage.objects
  for delete using (
    bucket_id = 'bond-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reads: authenticated users may select an object ONLY if it is registered in
-- the media table under a message they can see (prototype granularity; content
-- access is still enforced at the API layer before signing URLs).
create policy "media_read_via_registry" on storage.objects
  for select using (
    bucket_id = 'bond-media'
    and exists (
      select 1 from public.media m
      where m.object_name = name
        and (
          auth.uid() = m.owner_id
          or exists (
            select 1 from public.conversation_members cm
            where cm.conversation_id = m.message_id
              and cm.user_id = auth.uid()
          )
        )
    )
  );

commit;
