-- =============================================================================
-- Bond — Seed data (demo users for local testing)
-- -----------------------------------------------------------------------------
-- Requires the pgcrypto extension (enabled by default in Supabase).
-- Run AFTER the migrations, e.g. `supabase db reset` or paste into the SQL editor.
--
-- Creates two demo accounts with known credentials so you can test connections,
-- messaging and the signature features end-to-end:
--   alice@bond.app   /  bonddemo123
--   ben@bond.app     /  bonddemo123
-- =============================================================================

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@bond.app',
   crypt('bonddemo123', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'ben@bond.app',
   crypt('bonddemo123', gen_salt('bf')), now(), now(), now())
on conflict (id) do nothing;

-- The auth trigger (0002) created profiles automatically; update them with friendly data.
insert into public.profiles (id, display_name, bond_id, avatar_style, avatar_color, bio)
values
  ('00000000-0000-0000-0000-000000000001', 'Alice', 'alice', 0, 0, 'Hello from Bond'),
  ('00000000-0000-0000-0000-000000000002', 'Ben', 'ben', 3, 2, 'Stay close')
on conflict (id) do update
  set display_name = excluded.display_name,
      bond_id = excluded.bond_id,
      avatar_style = excluded.avatar_style,
      avatar_color = excluded.avatar_color,
      bio = excluded.bio;

-- Make Alice and Ben connected and in a conversation.
insert into public.connections (user_a, user_b, status, requested_by, invited_by)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
        'accepted', '00000000-0000-0000-0000-000000000001', null)
on conflict (user_a, user_b) do nothing;

insert into public.conversations (id, created_by)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.conversation_members (conversation_id, user_id)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.messages (id, conversation_id, sender_id, type, content, status)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'text',
   'Welcome to Bond, Ben! 👋', 'delivered'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'text',
   'Love it here. Stay close. 🤝', 'read')
on conflict (id) do nothing;

-- Alice opts in to receive "I Need You" alerts from her connections.
insert into public.i_need_you_prefs (user_id, opt_in)
values ('00000000-0000-0000-0000-000000000001', true)
on conflict (user_id) do nothing;

insert into public.i_need_you_prefs (user_id, opt_in)
values ('00000000-0000-0000-0000-000000000002', true)
on conflict (user_id) do nothing;
