# Bond — Architecture

> Stay close to the people who matter.

## Overview

Bond is a privacy-first communication platform for trusted connections (family,
close friends, partners). This document explains the system architecture and the
reasoning behind each choice.

## Products

| App | Stack | Purpose |
| --- | --- | --- |
| `apps/mobile` | Expo (React Native + TypeScript + Expo Router) | Primary experience: chat, Moments, shared space, unique features |
| `apps/web` | Vite + React + TypeScript | Feature-matched companion for desktop: chat, Connections, Moments, Shared Space, Bond Lock, Surprise Box, I Need You, Voice Diary, notifications, settings |
| `apps/site` | Static marketing site | Public info, features, privacy, FAQ, support |
| `apps/backend` | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) | Backend services |

## Why this stack?

### Mobile — Expo + React Native + TypeScript
- One codebase, runs on iPhone immediately inside **Expo Go** (no Android Studio
  required for development).
- TypeScript gives safety and an explicit data model shared across the codebase.
- Expo Router gives file-based navigation that stays predictable as the app grows.

### Backend — Supabase on the free tier
- **Auth + session handling** are implemented and maintained by a reputable,
  audited system instead of hand-rolled code.
- **Postgres Row-Level Security (RLS)** enforces data isolation in the database
  itself — a user can never query another user's private rows, even if an app bug
  tried to.
- **Realtime (WebSockets)** powers live messages, "I Need You" alerts, and
  presence without running a custom socket server.
- **Storage** hosts media with access rules.
- **Open source**: the whole stack can be self-hosted later, so Bond is never
  trapped behind a paid-only service.

### Why not Firebase?
Firebase is excellent, but it is closed source. Bond's identity is *privacy-
first*, so an open database with RLS and a credible long-term self-hosting path
fits the brand better.

### Why not a custom Node + Socket.io server?
It is more moving parts to secure and operate for a beginner. Supabase replaces a
whole server with clean, declarative SQL. A custom API can be added later as an
Edge Function layer if needed.

## Data model (core tables)

See `supabase/migrations/*.sql` for the authoritative schema. Core concepts:

- `profiles` — display name, Bond ID (`@handle`, unique), avatar, bio, privacy defaults
- `user_settings` — JSONB preferences (`push_notifications`, `quiet_hours`, …) owned by the user
- `connections` — accepted/requested/pending trust links between two users
- `conversations` + `conversation_members` — one conversation per connection pair
- `messages` — text, media pointers, reply-to, reactions, delivery/read state, Bond Lock marker
- `media` — registry for uploaded files (photos, voice, documents) in the private `bond-media` bucket
- `bond_lock_payloads` + `bond_lock_grants` — server-enforced "Bond Lock": hidden payloads (no SELECT policy) unlocked only via `unlock_bond_grant()`
- `user_devices` — push-capable devices per user (Expo tokens, revocable)
- `push_outbox` — private delivery queue for background push (zero RLS policies; Edge Function only)
- `moments` + `moment_views` — temporary updates with viewer scope + expiry
- `i_need_you` + `i_need_you_prefs` — the "I Need You" alert feature (opt-in, quiet hours)
- `shared_spaces`, `shared_space_members`, `memories`, `bucket_list_items` — shared connection-space features
- `surprise_boxes` — scheduled future messages revealed on a chosen date
- `notifications` — user-notification queue (in-app + push trigger)

## Security model

Three distinct layers are **not** to be confused (see `docs/security.md`):

1. **Transport encryption** — HTTPS/TLS for all traffic (Supabase enforces).
2. **Encryption at rest** — Postgres + Storage encryption managed by the host.
3. **End-to-end encryption** — a long-term goal only, via an audited library
   (Signal protocol, libsodium, etc.). The prototype intentionally does **not**
   claim E2EE.

Authorization is enforced by **Postgres RLS policies** (never trusting the client
alone) plus Supabase Auth sessions.

## Realtime architecture

- Messages and "I Need You" alerts: the app subscribes to `postgres_changes` on the
  tables it participates in (realtime publication + RLS) and writes through the same
  channel. Both the mobile and web apps live-update while connected.
- Connected peers see updates almost instantly while both have connectivity.
- In-app `notifications` rows (written by `SECURITY DEFINER` triggers) also arrive
  over Realtime, so the notification center refreshes without polling.
- **Honest limitation**: if a device is fully offline, a realtime event cannot
  arrive. Background push (below) covers closed/offline apps as best-effort.

## Push notifications

The delivery pipeline is now server-side, built entirely in SQL + one Edge Function:

- `SECURITY DEFINER` triggers on `notifications` enqueue a delivery row into
  `push_outbox` — only when the user has a device token, respecting the
  `push_notifications` opt-out and `quiet_hours` (I Need You bypasses quiet hours).
- `push_outbox` has RLS enabled with zero policies, so it is only reachable by the
  service role.
- `apps/backend/supabase/functions/process-push-outbox/` (Deno + supabase-js) is
  triggered on a schedule: it claims due rows, resolves tokens from `user_devices`,
  sends them in chunks of 100 to the **Expo push service** (APNs/FCM delivery),
  applies exponential backoff on temporary failures, marks permanent errors
  (DeviceNotRegistered, MessageTooBig, InvalidCredentials) as failed, and clears
  dead tokens.
- Clients register their Expo token into `user_devices` via
  `src/api/pushNotifications.ts` (mobile only; web has no push). Tapping a push
  deep-links into the app (`/chat/[id]` or `/i-need-you`).
- Secrets are supplied to the Edge Function with `supabase secrets set`
  (`SUPABASE_SERVICE_ROLE_KEY`, optional `EXPO_ACCESS_TOKEN`).

## Monorepo layout

Each app is standalone with its own `package.json` (deliberately no workspace
hoisting) — a beginner can open any folder and run it. Schema decisions live
once, in `supabase/migrations/`.

```
BOND/
├── apps/
│   ├── mobile/       # Expo Router screens (auth, tabs, detail)
│   │   ├── app/
│   │   └── src/      # theme, components, providers, api
│   ├── web/
│   ├── site/
│   └── backend/
│       ├── supabase/
│       │   ├── migrations/   # SQL: tables + RLS + triggers + functions
│       │   ├── functions/    # Deno Edge Functions (push delivery)
│       │   ├── seed/         # demo users
│       │   └── config.toml
│       ├── docs/             # security model
│       └── .env.example
└── docs/
```