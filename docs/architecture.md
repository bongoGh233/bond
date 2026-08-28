# Bond — Architecture

> Stay close to the people who matter.

## Overview

Bond is a privacy-first communication platform for trusted connections (family,
close friends, partners). This document explains the system architecture and the
reasoning behind each choice.

## Products

| App | Stack | Purpose |
| --- | --- | --- |
| `mobile/` | Expo (React Native + TypeScript + Expo Router) | Primary experience: chat, Moments, shared space, unique features |
| `web/` | Vite + React + TypeScript | Feature-matched companion for desktop: chat, Connections, Moments, Shared Space, Bond Lock, Surprise Box, I Need You, Voice Diary, notifications, settings |
| `website/` | Static marketing site | Public info, features, privacy, FAQ, support |
| `supabase/` | Postgres + Supabase Auth + Realtime + Storage | Backend services |

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
- `connections` — accepted/requested/pending trust links between two users
- `conversations` + `conversation_members` — one conversation per connection pair
- `messages` — text, media pointers, reply-to, reactions, delivery/read state, bond-lock flag
- `media` — registry for uploaded files (photos, video, voice, documents) in the private `bond-media` bucket
- `bond_lock_grants` — the "Bond Lock" access-grant system (message_id, grantee, mode, uses)
- `moments` + `moment_views` — temporary updates with viewer scope + expiry
- `i_need_you` + `i_need_you_prefs` — the "I Need You" alert feature (opt-in, quiet hours)
- `shared_spaces`, `shared_space_members`, `memories`, `bucket_list_items` — shared connection-space features
- `surprise_boxes` — scheduled future messages revealed on a chosen date
- `notifications` — user-notification queue (in-app)

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

- Messages: app subscribes to `postgres_changes` on the conversations it belongs
  to and inserts rows through the same channel.
- Connected peers see updates almost instantly while both have connectivity.
- **Honest limitation**: if a device is fully offline, a realtime alert cannot
  arrive. Pending payloads are queued and delivered on reconnect where the backend
  supports it (notification rows are persisted and fetched on next session).

## Push notifications (client scaffolded, delivery requires paid/capable infra)

The mobile client already has the push layer scaffolded: `expo-notifications` +
`expo-device` are installed, the `expo-notifications` plugin is in `app.json`,
`app/_layout.tsx` mounts a `NotificationProvider` that configures the foreground
handler, requests permission, registers the device with `user_devices` (populating
the reserved `token` column with an Expo push token) and deep-links to a chat when
a notification is tapped. `src/api/pushNotifications.ts` owns token registration,
listing and revoking devices (native-only; preview mode is a no-op).

What is **not** done yet — all backend/server requirements:
- **APNs (Apple) + FCM (Google)** credentials, Expo push service, and a real server
  that fans out notifications to recipient push tokens on new messages.
- A settings toggle / preference to opt in or out of push (currently registers on
  sign-in; permission prompt gates it).
- Delivery reliability, retry/queueing, and badge handling for closed apps.

Until these are in place the prototype uses in-app notifications and realtime
alerts instead — reliable only while the app is open.

## Monorepo layout

Each app is standalone with its own `package.json` (deliberately no workspace
hoisting) — a beginner can open any folder and run it. Schema decisions live
once, in `supabase/migrations/`.

```
BOND/
├── mobile/
│   ├── app/          # Expo Router screens
│   ├── src/
│   │   ├── theme/    # design tokens + themes
│   │   ├── components/
│   │   ├── lib/      # supabase client, api helpers
│   │   ├── features/ # conversations, connections, moments, ...
│   │   └── state/    # auth context, settings
│   └── app.json
├── supabase/
│   └── migrations/   # SQL: tables + RLS + triggers
├── web/
├── website/
└── docs/
```