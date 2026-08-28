# 💍 Bond

**Stay close to the people who matter.**

Bond is a professional, modern, privacy-first communication platform for *trusted
connections* — close friends, family, partners, and anyone you mutually choose to
connect with. It is **not a WhatsApp clone**; it has its own identity, focused on
privacy, permission-based alerts, and shared memories.

---

## 📦 What's in this repository

A monorepo with four connected parts:

| Directory       | What it is                                   | Stack                              |
|-----------------|----------------------------------------------|------------------------------------|
| `apps/mobile`   | 📱 **The main product** — mobile app         | React Native · Expo · TypeScript   |
| `apps/web`      | 💻 **Web companion** — computer access       | React · Vite · TypeScript          |
| `apps/site`     | 🌐 **Public website** — info / support       | React · Vite · TypeScript          |
| `apps/backend`  | 🧱 **Backend** — database, auth, realtime    | Supabase (Postgres + RLS + Realtime) |

The **mobile app is the primary experience**.

---

## 🧠 Recommended architecture (why we chose this)

- **React Native + Expo + TypeScript** — runs on a physical iPhone through **Expo Go**
  with **no Android Studio required**, which keeps the feedback loop fast.
- **Expo Router** — file-based, modern navigation that scales cleanly.
- **Supabase** — an open-source backend that bundles **Postgres**, **authentication**,
  **Row Level Security (RLS)** for authorization, and **Realtime** (websockets) on a
  generous free tier. This is what powers instant messaging, live "I Need You" alerts
  and notifications.

> **Zero-budget reality check:** The free Supabase tier is enough for development and
> small-scale use. If Bond grows to large numbers of users, features such as hosted
> realtime, push notifications, and email will eventually need paid infrastructure.
> We will always flag that before it happens. The schema is designed to scale.

---

## ▶️ Quick start

### 1. Install dependencies

Each app installs independently (kept simple on purpose):

```bash
# Mobile app
cd apps/mobile
npm install

# Web companion
cd ../web && npm install

# Public website
cd ../site && npm install
```

> Node.js 18+ and npm are required.

### 2. Run the mobile app and test on your iPhone (Expo Go)

```bash
cd apps/mobile
npx expo start
```

- Install the **Expo Go** app from the App Store on your iPhone.
- Make sure your phone and computer are on the **same Wi-Fi network**.
- Scan the **QR code** shown in the terminal with your iPhone's Camera app.
- The app opens in Expo Go. **No Mac, Android Studio, or Xcode is needed.**

> If the QR scan doesn't connect, press `s` in the Expo terminal to switch to a
> tunnel connection, or `r` to reload.

**Without a backend configured**, Bond runs in **local preview mode** — you can sign
up/log in and explore the full UI with demo data. To enable real accounts, messaging
and realtime, configure Supabase (step 4).

### 3. Run the web companion

```bash
cd apps/web
npm run dev
```

Open the printed local URL (e.g. `http://localhost:5173`). In preview mode you can log
in with any email/password.

### 4. Run the public website

```bash
cd apps/site
npm run dev
```

### 5. Configure the backend (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Apply the SQL migrations in `apps/backend/supabase/migrations/` (0001 → 0007, in
   order) via **SQL Editor** or the CLI. They create all tables, enable **RLS**, add
   the signup trigger, storage bucket, realtime publication, the Bond Lock RPCs,
   and the push outbox pipeline.
3. (Optional) Run `apps/backend/supabase/seed/0001_demo_users.sql` to create two demo
   accounts: `alice@bond.app` / `bonddemo123` and `ben@bond.app` / `bonddemo123`.
4. Copy the project URL and anon key from **Settings → API**.

**Push notifications (optional):**
- Deploy the Edge Function: `supabase functions deploy process-push-outbox` and
  schedule it (e.g. every minute) via `supabase functions schedule`.
- Set secrets: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` (and
  `EXPO_ACCESS_TOKEN=...` if you have an Expo project, which disables legacy push
  API). See `apps/backend/.env.example`.

### Configure environment variables

Copy each `.env.example` to `.env` and fill it in:

```bash
# Mobile (Expo inlines anything prefixed EXPO_PUBLIC_)
cp apps/mobile/.env.example apps/mobile/.env

# Web companion (Vite inlines anything prefixed VITE_)
cp apps/web/.env.example apps/web/.env
```

`.env.example` files are committed; `.env` files are git-ignored. **Never commit
real secrets, and never put the Supabase `service_role` key in a client app.**

- `apps/mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `apps/web/.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## 🔐 Authentication

- Welcome → sign up / log in → onboarding (choose a **Bond ID**, custom **avatar**,
  and basic **privacy** preferences) → the main Bond experience.
- Sessions persist on device in the **OS Keychain / Secure Enclave**
  (`expo-secure-store`), so you don't log in repeatedly.
- Log out and manage sessions/devices from Settings.

---

## 💬 Features (current state)

| Feature                    | Status                                                        |
|----------------------------|---------------------------------------------------------------|
| Design system / theming    | ✅ Light + dark theme, reusable components                    |
| Onboarding + Bond ID       | ✅                                                |
| Avatars (generated)        | ✅ Privacy-friendly, no paid service                          |
| Private messaging UI       | ✅ Text + photo chat, receipts, realtime subscribe            |
| Connections                | ✅ Search, request, accept/decline, remove                    |
| **I Need You**             | ✅ Opt-in, urgent alerts, realtime, acknowledge flow          |
| **Bond Lock**              | ✅ Server-enforced: one-time / timed / repeat grants, revoke  |
| **Moments**                | ✅ Text/photo, durations, viewers, expiry                     |
| Shared Space / Memories    | ✅ Spaces, memories, bucket list                              |
| Surprise Box               | ✅ Scheduled future messages, open/delete                     |
| Media upload (storage)     | ✅ Real upload to `bond-media` bucket, server-verified reads  |
| Notifications center       | ✅ In-app list + mark read + Realtime                         |
| Push notifications         | ✅ Backend pipeline (outbox + Edge Function → Expo)          |
| Voice Diary                | ✅ Real recording + playback (mobile + web)                   |

Each item marked as a work-in-progress (`WIP`) is clearly labelled in the UI with a
"coming in Phase X" tag rather than being faked.

> **Preview mode:** Without Supabase env vars the app runs on built-in demo data so
> the whole UI is explorable. Set `EXPO_PUBLIC_SUPABASE_URL` /
> `EXPO_PUBLIC_SUPABASE_ANON_KEY` to switch to the real backend (auth, messaging,
> realtime, and real media upload).

---

## 🔒 Security & privacy (honest summary)

- **RLS is enabled on every table.** Users can only read rows they own or are
  authorized to see (conversation members, connection participants, etc.).
- **Transport** is HTTPS/WSS to Supabase.
- **At rest** data is encrypted by the host; media lives in a private storage bucket.
- **True end-to-end encryption is NOT implemented yet** — and we won't claim it is.
  It's a documented long-term goal on audited protocols.
- The app only uses the client (**anon**) key; never the service_role key.
- "I Need You" and push alerts require connectivity — offline alerts are **queued**
  and delivered on reconnect, never claimed as instant.

See `apps/backend/docs/security.md` for the full prototype-vs-production breakdown.

---

## 🧭 Project structure

```
apps/
  mobile/
    app/                  # Expo Router screens (auth, tabs, detail)
    src/
      components/ui/      # Reusable design-system components
      theme/              # Tokens (colors, type, spacing) & themes
      providers/          # Theme + Auth contexts
      api/                # Supabase client + typed helpers
  web/
    src/pages/            # Login, Signup, AppShell, Chats, Connections, Moments,
                          # Shared, Bond Lock, Surprise Box, I Need You, Voice Diary,
                          # Notifications, Settings
    src/api/              # Supabase client helpers + typed feature data layers
  site/
    src/                  # Marketing landing page
  backend/
    supabase/migrations/  # SQL schema + RLS (apply in order)
    supabase/seed/        # Demo users
    docs/                 # Security model
```

---

## 🗺️ Roadmap

- **Phase 3–4:** Connections + real-time messaging. ✅ Done
- **Phase 5:** I Need You, Bond Lock, Moments, Shared Space / Memories /
  Bucket list, Surprise Box. ✅ Done
- **Phase 6:** Media upload to private storage, in-app notifications center. ✅ Done
- **Phase 7:** Voice Diary (real recording + playback on mobile and web). ✅ Done
- **Web companion parity:** Chats, Connections, Moments, Shared Space, Bond Lock,
  Surprise Box, I Need You, Voice Diary + notifications — matching the mobile app,
  with the same preview-mode demo data. ✅ Done
- **Bond Lock hardening:** server-enforced capability model (`bond_lock_payloads`
  with no SELECT policy; `create_bond_lock` / `unlock_bond_grant` /
  `revoke_bond_lock` RPCs). ✅ Done
- **Push notifications:** server-side pipeline — `push_outbox` + enqueue trigger
  (quiet hours, opt-out, I Need You bypass) and the `process-push-outbox` Edge
  Function delivering via Expo push. ✅ Done
- **Next:** apply migrations to a live Supabase project, deploy the Edge Function
  schedule, and register Expo credentials.
- **Phase 8:** Polish, edge-case handling, security review.
- **Phase 9 (long-term):** Audited end-to-end encryption.

---

## 🧪 Known limitations

- End-to-end encryption not yet implemented (documented above).
- Bond Lock protection is server-enforced authorization, not cryptography —
  payloads remain readable by operator infrastructure until E2EE lands.
- Realtime/push at scale requires a paid backend tier.
- Push delivery is best-effort; Expo credentials (APNs/FCM) must be configured in
  the hosted project and the Edge Function scheduled.

---

## 📄 License & status

**Early prototype.** This is a foundation designed to grow into a real product —
clean code, honest feature labelling, and privacy by design.
