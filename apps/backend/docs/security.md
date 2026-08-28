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

## 3. Bond Lock — prototype mechanics

Bond Lock is currently a **demonstration flow**, not a cryptographic access
control system.

- Protected media is flagged on the message row (`bond_lock = true`).
- Access is granted via a `bond_lock_grants` row (one-time / time-limited /
  each-time) that the **recipient's client checks** before revealing the content.
- Optional short access tokens are demonstrated for the UI flow.

**Production would replace this** with server-enforced, cryptographically signed
capabilities (e.g. short-lived signed URLs that the sender's server issues only
after an approved grant, plus content encryption). A 4-digit PIN is **not** the
security boundary; it is only a UX convenience and is not relied upon as the sole
protection.

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
- **Prototype gap:** signed-URL creation is initiated by the client after the client
  checks membership. Production should create signed URLs behind a server function
  that re-checks conversation/space membership server-side (the data needed to do
  that is already in `media`).
- In **preview mode** (no backend env), uploads no-op and the local `file://` URI is
  used so images still render in the demo.

---

## 7. Preview mode (no backend)

When `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are not set, the
app runs entirely on **in-memory demo data** (`src/api/*` preview branches). This
lets the whole UI be explored with no account. Preview state resets on reload and is
never persisted or sent anywhere. Switching on the env vars moves the same screens to
real Supabase rows. Nothing in preview mode fakes security claims.

---

## 8. Operational hardliners (both prototype and production)
- Secret keys live in `.env` (git-ignored), with `.env.example` committed for
  reference. **Never** commit real secrets.
- The `service_role` key must never appear in a client bundle.
- Users can review and revoke active sessions/devices.
