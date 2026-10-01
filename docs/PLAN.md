# ConnectWOL – implementation plan

ConnectWOL is a self-hosted Wake-on-LAN web app: unlimited devices, no accounts, no analytics.
Browsers cannot send raw UDP, so the **server** sends the magic packet from a machine on the
same LAN as the targets. The browser UI (installable as a PWA) only talks to the app's own API.

## Architecture

```
Phone / laptop browser (PWA)  ──HTTPS/VPN──►  Next.js server on an always-on LAN host
                                              ├─ route handlers (Node.js runtime)
                                              ├─ SQLite file (better-sqlite3 + Drizzle)
                                              └─ node:dgram ──UDP broadcast/unicast──► sleeping PC
```

* **Next.js 16 (App Router), TypeScript strict.** Every route handler is `runtime = 'nodejs'`.
* **SQLite via better-sqlite3 + Drizzle ORM.** One file, zero services, synchronous driver (no
  async gaps inside transactions), prebuilt binaries for x64/arm64. Drizzle gives a typed schema
  that is the single source of truth for generated SQL migrations (`drizzle/`), applied at start-up.
* **Passwords: Argon2id** through `@node-rs/argon2` (prebuilt napi binaries, OWASP-recommended
  defaults, no compiler needed on a Raspberry Pi).
* **Validation: zod 4**, with schemas in `src/lib/schemas.ts` shared by server and client.
* **Plain CSS with design tokens** (no UI framework): one distinctive identity, no third-party
  requests (fonts are the system stack), tiny bundle.
* **Tests: Vitest.** Unit tests for the MAC parser, packet builder, broadcast planning, UDP sender
  (real loopback sockets), TCP status probe, rate limiter; integration tests call the exported
  route handlers directly with `Request` objects against an in-memory database.

## Folder structure

```
src/
  app/                 routes: (auth) login/setup, (app) devices/history/guide/settings/about, api/*
  components/          client UI (device list, forms, wizard, illustrations, nav)
  lib/                 isomorphic code: mac parser, zod schemas, brand, api client
  server/
    config.ts          env parsing
    db/                schema.ts, index.ts (lazy open + migrate)
    auth/              password, sessions, cookies, csrf/origin checks, rate limiter
    wol/               packet, network planning, dgram sender, TCP status probe
    services/          devices, history, settings (the only code that touches tables)
    http.ts            route wrapper: auth, CSRF, rate limit, validation, error mapping
drizzle/               generated SQL migrations
public/                sw.js, offline.html, icons
tests/                 unit/ and integration/
```

## Data model

| table      | columns |
|------------|---------|
| `users`    | id, username (unique), password_hash, created_at |
| `sessions` | id (sha-256 of token), user_id → users, csrf_token, created_at, last_seen_at, expires_at, user_agent |
| `devices`  | id, name, mac (normalised), target, port (default 9), wake_mode (`local`/`remote`), broadcast?, secure_on?, icon?, color?, group_name?, status_port?, sort_order, created_at, updated_at |
| `wake_log` | id, device_id? (no FK: history outlives devices), device_name, mac, mode, destinations (JSON), attempts, result (`sent`/`partial`/`failed`), detail?, created_at |
| `settings` | key, value (JSON): `defaultPort`, `repeatCount` |

## API routes (all JSON, all require a session except where noted)

| route | purpose |
|-------|---------|
| `GET /api/health` (public) | liveness for Docker |
| `GET /api/auth/session` (public) | `{setupRequired, authenticated, username?, csrfToken?}` |
| `POST /api/auth/setup` (public, once) | create the admin account |
| `POST /api/auth/login` (public, rate limited) | start a session |
| `POST /api/auth/logout` | end the session |
| `POST /api/auth/password` | change password (ends other sessions) |
| `GET/POST /api/devices` | list / create |
| `GET/PATCH/DELETE /api/devices/:id` | read / update / delete |
| `POST /api/devices/:id/duplicate` | duplicate |
| `POST /api/devices/:id/wake` (rate limited) | wake one device |
| `POST /api/wake` (rate limited) | wake a group (`{group}`) or a set (`{ids}`) |
| `POST /api/devices/reorder` | persist a new order |
| `POST /api/devices/status` | best-effort TCP probe for devices that have a status port |
| `GET /api/devices/export`, `POST /api/devices/import` | JSON backup / restore |
| `GET/DELETE /api/history` | wake log / clear |
| `GET/PUT /api/settings` | default port, repeat count |

## Security model

* Admin account created on first launch (optionally gated by `SETUP_TOKEN`).
* Opaque 256-bit session token in an HTTP-only, `SameSite=Lax` cookie (`Secure` over HTTPS); only a
  SHA-256 hash is stored server-side. Sliding 30-day expiry.
* CSRF: per-session synchroniser token in `X-CSRF-Token` on every authenticated mutation, plus an
  `Origin`/`Sec-Fetch-Site` check and JSON-only bodies on all mutations (including login/setup).
* Rate limiting (in memory): login per IP and per account, wake per session.
* Every input validated with zod; request bodies size-capped.
* Standard hardening headers and a restrictive CSP.

## Wake engine

* Packet = 6×`FF` + 16×MAC (+ SecureOn password) → 102 / 106 / 108 bytes.
* **Local mode:** broadcast sockets, bound per local interface, sent to the subnet-directed
  broadcast (explicit, derived from the target's subnet, or every interface's) *and*
  `255.255.255.255`.
* **Remote mode:** resolve host (DDNS ok) and send unicast.
* Each packet is repeated *N* times with a short delay; the UI only ever claims "sent", never "woke".
* Status check = TCP connect probe (connect → online, refused → host answered, timeout → no answer).

## Build order

1. Wake engine + unit tests → 2. DB + auth → 3. API + integration tests → 4. Device UI →
5. Wizard → 6. Settings & import/export → 7. Docker, PWA, README. Run typecheck/lint/tests after each stage.
