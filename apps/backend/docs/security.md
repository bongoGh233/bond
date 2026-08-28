# Bond — Security Model

Bond treats privacy as a core value. This document is an honest account of what
is **actually implemented** in the prototype versus what a **production** system
would need. We never claim security that isn't real.

---

## 1. What IS implemented

### Transport (in transit)
- All traffic to Supabase (PostgREST + Realtime) uses **TLS (HTTPS / WSS)** out of
  the box. No plaintext credentials are ever sent.
- Auth sessions are managed by **Supabase Auth** (GoTrue), a battle-tested,
  open-source implementation. Passwords are stored by Supabase as bcrypt hashes,
  never in plaintext.

### Session handling (on device)
- The app stores the **access token in the OS Keychain / Secure Enclave** via
  `expo-secure-store`, NOT in `AsyncStorage` or plaintext in the bundle.

### Authorization (at rest / API)
- **Row Level Security (RLS)** is enabled on **every** Bond table (see
  `supabase/migrations/0002_rls_auth_realtime.sql`). Even the public `anon` key
  cannot read another user's private rows.
- Example guarantees enforced in SQL:
  - `messages`: only visible to conversation members.
  - `connections`: only visible to the two participants.
  - `connections` (I Need You): only insertable for **accepted** connections.
  - `i_need_you_prefs`: only the owner can edit their opt-in.
- The app only ever uses the **anon** client key; the `service_role` key is
  never embedded in a client and is the only thing that could bypass RLS.

---

## 2. What the prototype intentionally does NOT claim

Bond does **not** currently implement true **End-to-End Encryption (E2EE)**.

The current guarantees are:
| Guarantee            | Status in prototype                                              |
|----------------------|------------------------------------------------------------------|
| Transport encryption | ✅ HTTPS / WSS to Supabase                                       |
| Encryption at rest   | ✅ Host DB encrypted; media in private storage bucket            |
| **True E2EE**        | ❌ **Not implemented** — see below                               |

### Why E2EE is a long-term goal, not a checkbox
True E2EE means only the two conversation participants hold the decryption keys
and the server (Supabase) cannot read message content. This requires a mature,
**audited** protocol and per-device key management (e.g. Signal Protocol /
Double Ratchet, or an audited library — we will not hand-roll cryptography).

Until then:
- Message bodies are stored **encrypted at rest** by the host but are readable by
  the operator's infrastructure, exactly like most mainstream messaging apps.
- We do **not** claim "end-to-end encrypted" anywhere in the product or docs.

### Roadmap for real E2EE (Phase 9+)
1. Integrate an audited library (e.g. `libsignal`, the Signal Protocol) or a
   managed E2EE layer.
2. Add per-device identity keys and secure key exchange.
3. Move attachments to E2E-encrypted blobs with per-message keys.
4. Full security audit and public transparency report.

---

## 3. Bond Lock — server-enforced capability model

Bond Lock is **server-enforced authorization**, not cryptography.

- The real content lives in `bond_lock_payloads`, which has **no SELECT policy** —
  not even conversation members can read it through normal SQL/RLS.
- `create_bond_lock()` (SECURITY DEFINER) atomically creates the marker message,
  the hidden payload, and a `bond_lock_grants` row with a server-generated token.
- `unlock_bond_grant()` is the **only** path that returns content. It re-validates
  the grantee, status, expiry (`time_limited`) and remaining uses (`one_time`),
  decrements one-time uses atomically, and auto-marks expired grants.
- `revoke_bond_lock()` lets the sender revoke at any time; revoked or denied
  grants can never unlock.

Honest limits:
- There is **no homemade encryption**. `bond_lock_payloads.content` is stored on
  the server and remains readable by operator infrastructure, like every other
  row in the prototype. Protection is unguessable storage plus server-side
  authorization checks enforced in SQL.
- Media Bond Locks (photos/videos behind a lock) would extend the same model with
  object keys in `media_metadata`; that is a future enhancement.

---

## 4. "I Need You" — honest connectivity note

A real-time alert fundamentally requires a network connection to reach the other
device:
- If the recipient is **online**, a push/realtime notification is delivered
  immediately.
- If the recipient is **offline / no network**, the alert is **queued** and
  delivered when they reconnect (via Supabase Realtime) or by notification push.

Bond does **not** claim that an offline phone receives an internet notification
instantly. Quiet hours and per-connection opt-in are respected.

---

## 5. Surprise Box — honesty note

Surprise Box stores a message that is only revealed after `reveal_at`.

- **Row-level security** restricts reads to sender + recipient (`surprise_boxes_select`).
- The **recipient's client** enforces the reveal date before displaying content; the
  sender can delete the box before it is delivered.
- This is a **UX/time-gated** flow, not a cryptographic commitment. The server COULD
  technically read a not-yet-revealed message. True "mailbox sealed until the date"
  semantics would require server-side functions that decrypt only after `reveal_at`
  (a production enhancement, not claimed here).

---

## 6. Media upload — prototype scope

Photos in messages and Moments are uploaded to the private `bond-media` bucket
(migration 0003) under `{owner_id}/{uuid}.{ext}`.

- **Writes** are restricted to the owner's own folder via a storage policy.
- Every upload is **registered** in the `media` table with its owning message/moment;
  reads of the object are only allowed through the registry when the user is the
  owner *or* a member of the message's conversation.
- The **app requests a short-lived signed URL** to render each file.
- **Enforcement:** the storage read policy is backed by `storage_can_read_object()`
  (migration 0005), a server-side helper that re-checks ownership or conversation /
  space / moment-member access inside SQL. A user cannot obtain a signed URL for
  media they aren't authorized to read — enforcement no longer trusts the client.
- In **preview mode** (no backend env), uploads no-op and the local `file://` URI is
  used so images still render in the demo.

---

## 7. Notifications & push delivery

All notifications — messages, connection events, Moment views, Surprise Box, Bond
Lock and I Need You — are written server-side into `notifications` by the trigger
functions in migration 0005 and surfaced to clients over **Realtime**.

Background push is a separate private pipeline:

- `notifications` triggers enqueue rows into `push_outbox` (migration 0007). The
  table has RLS enabled with **zero policies** — no client can read or write it.
- A `SECURITY DEFINER` trigger only enqueues when the user has a device token in
  `user_devices`, respects the user's `push_notifications` opt-out, and honors
  `quiet_hours` — except for **I Need You**, which intentionally bypasses quiet
  hours because it is urgent.
- The `process-push-outbox` Edge Function (service role only) flushes due rows to
  the **Expo push service**, which delivers to APNs/FCM. Device tokens are only
  ever read server-side and are never exposed to other clients.
- Delivery is best-effort and retried with exponential backoff; permanently dead
  tokens are cleared from `user_devices`. Offline users receive pushes at next
  reconnect; nothing is claimed to be instant.

---

## 8. Preview mode (no backend)

When `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are not set, the
app runs entirely on **in-memory demo data** (`src/api/*` preview branches). This
lets the whole UI be explored with no account. Preview state resets on reload and is
never persisted or sent anywhere. Switching on the env vars moves the same screens to
real Supabase rows. Nothing in preview mode fakes security claims.

---

## 9. Operational hardliners (both prototype and production)
- Secret keys live in `.env` (git-ignored), with `.env.example` committed for
  reference. **Never** commit real secrets.
- The `service_role` key must never appear in a client bundle.
- Users can review and revoke active sessions/devices.
