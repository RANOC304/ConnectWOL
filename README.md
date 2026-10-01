# ConnectWOL

Wake your computers from your phone, or from anywhere, with a self-hosted Wake-on-LAN app.

* **Unlimited devices.** Add, edit, duplicate, reorder, group, search, back up. No paywall, no cap.
* **One tap.** A big power button per computer, with a satisfying animation and honest feedback.
* **Guided setup.** A seven-step wizard (BIOS/UEFI, Windows/macOS/Linux adapter settings, Fast Startup, finding your MAC, testing, remote access) with original diagrams and a troubleshooting guide.
* **Private by design.** No accounts with anyone, no analytics, no ads, no cloud. Everything lives in one SQLite file on your own server.
* **Installable.** Works as a PWA: add it to your phone's home screen.

> **Honesty note.** Wake-on-LAN has no acknowledgement. ConnectWOL can tell you that magic packets were *sent*, and, if you configure a status port, whether the computer starts *answering* afterwards. It can never prove a packet reached the network card. Whether a machine wakes depends on its hardware, firmware, OS settings and network. The in-app guide covers all of it.

---

## Contents

1. [How it works](#how-it-works)
2. [Why it cannot run on Vercel (or any serverless host)](#why-it-cannot-run-on-vercel-or-any-serverless-host)
3. [Install](#install): Raspberry Pi / Linux with Docker · Node.js without Docker · Docker Desktop
4. [First run](#first-run)
5. [Configuration](#configuration)
6. [Remote access](#remote-access): Tailscale · WireGuard · reverse proxy
7. [Security model](#security-model)
8. [Data, backups and upgrades](#data-backups-and-upgrades)
9. [Technology choices](#technology-choices)
10. [Development](#development)
11. [Manual testing checklist on a real network](#manual-testing-checklist-on-a-real-network)
12. [Known limitations](#known-limitations)
13. [Privacy statement](#privacy-statement)

---

## How it works

```
 phone / laptop browser (PWA)
        │  HTTPS or VPN
        ▼
 ┌─────────────────────────── always-on machine on your LAN ──────────────────────────┐
 │  ConnectWOL (Next.js, Node.js runtime)                                              │
 │   ├─ SQLite file  ← devices, history, settings, hashed sessions                     │
 │   └─ node:dgram ──► UDP magic packet ──► broadcast on the LAN (or unicast, remote)  │
 └──────────────────────────────────────────────────────────────────────────────────────┘
                                         ▼
                              sleeping computer's network card
```

A magic packet is 6 × `FF` followed by the target MAC repeated 16 times (102 bytes, plus an optional 4- or 6-byte SecureOn password). Browsers cannot send raw UDP, so the **server** sends it, from a machine on the same network as your computers.

* **Same network (default):** the packet is broadcast on the subnet of the target. ConnectWOL works out the subnet-directed broadcast address (or uses your override), binds one socket per network interface so multi-homed hosts use the right card, and also sends to `255.255.255.255`. Each packet is repeated (default 3×) because UDP is unreliable.
* **Another network:** the host name or DDNS name is resolved and the packet is sent unicast to that address and port, for example to a forwarded port on your home router. See [step 7 of the guide](#remote-access) for why that needs a static ARP entry.
* **Status check (optional):** the server tries a TCP connection to a port you choose (3389, 22, 445…). Accepted or refused means the computer answered; a timeout means no answer. It is labelled *best effort* everywhere because a firewall that drops packets looks like a machine that is off.

## Why it cannot run on Vercel (or any serverless host)

It is tempting to deploy a Next.js app to Vercel, Netlify or Cloudflare. **Don't**, for three independent reasons:

1. **The packet must start inside your LAN.** A magic packet is a *local broadcast*. Serverless functions run in a provider's data centre. They cannot reach your 192.168.x.x network, and broadcasts do not cross the internet.
2. **Serverless platforms do not allow what the wake engine needs.** Edge and serverless runtimes restrict raw `dgram` (UDP) sockets and give you no control over which network interface is used.
3. **The data would not persist.** ConnectWOL stores everything in a local SQLite file. Serverless file systems are ephemeral and read-only, and every invocation may run on a different machine.

The right place is an always-on device **on your LAN**: a Raspberry Pi, NAS, mini PC or home server. You reach it from outside through a [VPN or HTTPS reverse proxy](#remote-access), and the packet is still sent locally, so nothing about waking needs to be exposed to the internet.

---

## Install

You need an always-on machine on the same network (ideally on **Ethernet**) as the computers you want to wake.

### Raspberry Pi or any Linux host, with Docker (recommended)

Docker's `network_mode: host` is what lets the container send UDP **broadcast** packets onto your real LAN. (In bridge mode the broadcast never leaves Docker's private network and Wake-on-LAN silently fails.)

```bash
# 1. Install Docker (skip if you have it) – https://docs.docker.com/engine/install/
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out and in again afterwards

# 2. Get ConnectWOL
git clone <your repository URL> connectwol
cd connectwol

# 3. Optional: configure. Recommended: protect first-run setup with a token.
cp .env.example .env
nano .env                         # e.g. SETUP_TOKEN=some-long-random-string

# 4. Build and start
docker compose up -d --build
```

Open `http://<host-ip>:3000` from a phone or laptop on the same network. Data lives in the `connectwol-data` volume (`/data/connectwol.db` inside the container).

* Works on 64-bit Raspberry Pi OS (arm64) and x86-64. On 32-bit ARM the native modules compile from source, which takes a few minutes.
* The first build on a Raspberry Pi takes a while (several minutes) and the Next.js build is memory-hungry; on boards with little RAM, add swap or build the image on a bigger machine.
* The compose file uses `env_file` with `required: false`, which needs Docker Compose v2.24 or newer.
* Change the port with `PORT=` in `.env`. With host networking the `ports:` mapping does not apply.
* Logs: `docker compose logs -f`. Update: `git pull && docker compose up -d --build`.

### Node.js without Docker

Requires Node.js **22 or newer** (better-sqlite3 13 needs it).

```bash
git clone <your repository URL> connectwol && cd connectwol
npm ci
npm run build
DATABASE_PATH=./data/connectwol.db PORT=3000 npm start
```

To run it as a service on Linux, create `/etc/systemd/system/connectwol.service`:

```ini
[Unit]
Description=ConnectWOL
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=connectwol
WorkingDirectory=/opt/connectwol
Environment=NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
Environment=DATABASE_PATH=/var/lib/connectwol/connectwol.db
EnvironmentFile=-/etc/connectwol.env
ExecStart=/usr/bin/npm start
Restart=on-failure
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd --system --home /var/lib/connectwol --create-home connectwol
sudo systemctl enable --now connectwol
```

On Windows or macOS this is also the way to run ConnectWOL **on a home PC/Mac that stays on**: the packets then really do leave your machine onto your LAN.

### Docker Desktop (Windows / macOS): limited

Docker Desktop runs containers in a VM; `network_mode: host` there means the VM, not your computer. So:

| | Works | Does not work |
|---|---|---|
| Web UI, accounts, device list, history, import/export, the guide | ✔ | |
| “Another network” (unicast) wake to a routable address, e.g. a forwarded port on a DDNS name | ✔ | |
| “Same network” broadcast wake-up | | ✘ the broadcast stays inside the VM |
| Unicast to a LAN IP of a *sleeping* computer | | ✘ unreliable: nothing answers ARP (guide, step 7) |

Use `docker compose -f docker-compose.desktop.yml up -d --build` if you only want the UI/remote mode, but for a real home setup, run ConnectWOL on Linux or directly with Node.js on the Windows/macOS machine.

---

## First run

1. Open the app. With an empty database you are sent to **Create your account**: pick a username and a password of at least 10 characters. This is the only account. It is stored as a salted **Argon2id** hash.
   * Anyone who can reach the app *before you finish this step* could claim the account. If the server is reachable by other people (or from the internet), set `SETUP_TOKEN` first. The setup form then asks for it.
2. You land on **Your computers**. Tap **Add a computer**: name, MAC address (any format), address and port. Advanced options cover the broadcast address, SecureOn password, a status-check port and “another network” mode.
3. New to Wake-on-LAN? Open the **Guide**: seven steps from BIOS settings to remote access, plus troubleshooting. It is optional, never forced, and any step can be reopened later. Step 6 sends a real test packet from inside the guide.
4. **Install it on your phone** (Settings → Install on your phone). Browsers only offer installing over HTTPS or `localhost`, so for a phone use a [VPN with HTTPS or a reverse proxy](#remote-access).

---

## Configuration

All environment variables are optional. See [`.env.example`](.env.example).

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port. |
| `HOSTNAME` | `0.0.0.0` (Docker) | Bind address. |
| `DATABASE_PATH` | `./data/connectwol.db` (`/data/connectwol.db` in Docker) | SQLite file. Created on first start; migrations run automatically. |
| `SETUP_TOKEN` | *(none)* | If set, creating the first admin account requires it. |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-For/-Proto/-Host`. **Only behind a reverse proxy you control.** |
| `COOKIE_SECURE` | `auto` | `auto` marks the session cookie `Secure` when the request is HTTPS (via `X-Forwarded-Proto` when `TRUST_PROXY=true`). `true`/`false` forces it. |
| `ALLOWED_ORIGINS` | *(none)* | Extra origins allowed to call the API (comma separated). Rarely needed. |
| `SESSION_TTL_DAYS` | `30` | Sliding session lifetime. |
| `NEXT_TELEMETRY_DISABLED` | set in the Dockerfile | Next.js's *build tool* has its own anonymous telemetry. Set `1` for local builds too (or run `npx next telemetry disable`). It is unrelated to the app, which sends nothing. |

In **Settings** (stored in the database): default UDP port, packet repeat count (1–10), password change, and theme (stored per browser).

---

## Remote access

The recommended pattern is to **reach ConnectWOL securely and let it send the packet locally**. Pick one.

### A. A VPN (safest)

Your phone joins your home network virtually; ConnectWOL is never exposed to the internet.

**Tailscale** (easiest):

```bash
# on the ConnectWOL host
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo tailscale serve --bg 3000      # optional: HTTPS on your tailnet name, needed for PWA install
```

Install Tailscale on your phone, sign in with the same account, then open `http://<host-name>:3000` (or the HTTPS name from `tailscale serve`). When you use `tailscale serve`, set `TRUST_PROXY=true` so cookies are marked Secure. Tailscale uses its own coordination service to connect your devices (traffic is end-to-end encrypted). ConnectWOL itself talks to nothing.

**WireGuard** (fully self-hosted): run a WireGuard server on your router or on the ConnectWOL host (PiVPN / wg-easy make this a guided install), add your phone, and open `http://<host-LAN-IP>:3000` while connected. You forward one UDP port for WireGuard itself and nothing else.

### B. HTTPS reverse proxy

Use this if you want to open ConnectWOL from any browser without a VPN. The app has its own login, CSRF protection and rate limiting, but this still puts a control panel on the internet, so use a long password and consider an allow-list or extra layer.

**Caddy** (certificates are automatic):

```caddyfile
wol.example.com {
	reverse_proxy 127.0.0.1:3000
}
```

**nginx:**

```nginx
server {
  listen 443 ssl http2;
  server_name wol.example.com;
  # ssl_certificate ... (e.g. from certbot)

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then set `TRUST_PROXY=true` for ConnectWOL. This makes it trust the proxy's `X-Forwarded-*` headers for per-client rate limiting (the right-most `X-Forwarded-For` entry, the one your proxy appended), Secure cookies and the origin check. **Never set it when the app is directly reachable**, or clients could forge those headers. Add HSTS at the proxy (`Strict-Transport-Security`) once HTTPS works.

### C. Port forwarding to a computer (advanced)

You can also run ConnectWOL somewhere else and wake a computer by sending a unicast packet to your home's DDNS name and a forwarded UDP port (device → Advanced → *Another network*). This opens a UDP port to the internet, and a sleeping computer's ARP entry on the router expires, so you need a static ARP / IP–MAC binding or the packet is dropped. The guide's step 7 explains both with diagrams. Prefer A or B.

### Why serverless can't be the “remote” part

See [above](#why-it-cannot-run-on-vercel-or-any-serverless-host). Remote access means *reaching your LAN host*, not moving the app to the cloud.

---

## Security model

Anyone who reaches the app can wake machines, so it is protected like any control panel:

* **Authentication:** single admin created on first launch (optionally gated by `SETUP_TOKEN`). Passwords hashed with **Argon2id** (19 MiB, 2 iterations: OWASP's minimum profile). Login does a dummy hash for unknown users so timing does not reveal whether a username exists.
* **Sessions:** 256-bit random token in an **HTTP-only, SameSite=Lax** cookie (`Secure` over HTTPS). Only the SHA-256 of the token is stored. Sliding 30-day expiry. Changing the password signs out every other session.
* **CSRF:** every authenticated state-changing request needs a per-session `X-CSRF-Token` header (compared in constant time). On top of that, all mutating requests pass a same-origin check (`Sec-Fetch-Site`, falling back to `Origin` vs host) and must be JSON.
* **Rate limiting:** login is throttled per client *and* per account (8 failures / 15 min); setup, password change, wake (60/min), group wake (12/min) and status checks are limited per session.
* **Validation:** every input is parsed with zod on the server (strict MAC/host/port rules, length caps, body-size caps: 64 KiB, 5 MiB for imports). Imports are all-or-nothing.
* **Headers:** a strict Content-Security-Policy (no third-party anything), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control: no-store` on all API responses.
* **Service worker:** never caches API responses or HTML, only versioned build assets and icons.

What it does *not* do: multi-user accounts/roles, MFA, or audit logging beyond the wake history. The wake and status endpoints let a signed-in user make the *server* send UDP / open TCP connections to addresses they choose (needed for remote mode), so treat the account like shell-lite access to your LAN.

---

## Data, backups and upgrades

* **Where:** one SQLite file (WAL mode). In Docker: the `connectwol-data` volume. Otherwise `DATABASE_PATH`.
* **Back up devices:** Settings → *Export devices* downloads JSON (it includes SecureOn passwords, so keep it private). *Import* can add to or replace the list, and is all-or-nothing with per-entry error messages.
* **Back up everything:** copy the database file while the app is stopped (or use `sqlite3 connectwol.db ".backup backup.db"`).
* **Upgrade:** pull and rebuild. Schema migrations (`drizzle/`) are applied automatically on start.
* **Erase everything:** stop the app and delete the data volume/folder.

---

## Technology choices

* **Next.js 16 (App Router), TypeScript strict.** All route handlers run on the Node.js runtime (UDP/TCP and SQLite need it). Output is `standalone` for a small Docker image.
* **SQLite via better-sqlite3 + Drizzle ORM.** One file and zero services suits a self-hosted home tool; better-sqlite3's synchronous driver keeps transactions simple and race-free (the first-run “only one admin” guarantee relies on this) and ships prebuilt binaries for x64/arm64. Drizzle keeps the typed schema (`src/server/db/schema.ts`) as the single source of truth for generated SQL migrations.
* **Argon2id via `@node-rs/argon2`.** Prebuilt N-API binaries, so no compiler is needed on a Raspberry Pi.
* **zod 4.** One schema set (`src/lib/schemas.ts`) validates the same rules in the browser form and on the server.
* **Plain CSS with design tokens, system font stack.** No UI framework and no third-party requests. The colour tokens are tested against WCAG contrast.
* **Vitest** for unit and integration tests.

---

## Development

```bash
npm ci
npm run dev            # http://localhost:3000   (use npm run dev:webpack if native SWC is blocked, see below)
npm test               # unit + integration tests
npm run typecheck
npm run lint
npm run build && npm start
npm run db:generate    # after editing src/server/db/schema.ts: writes a new SQL migration to drizzle/
npm run icons          # regenerate PWA icons (dependency-free script)
```

Project layout:

```
src/app/            routes: (auth) login/setup · (app) devices, history, guide, settings, about · api/*
src/components/     UI: device list/cards/form, guide (steps, diagrams), settings, shell
src/lib/            code shared by browser and server: MAC parser, zod schemas, API client, brand
src/server/         config · db · auth (passwords, sessions, CSRF, rate limits) · wol (packet, plan, send, status) · services
tests/              unit/ (parser, packet, planning, UDP/TCP on loopback, auth utils, service worker, contrast)
                    integration/ (auth + every API route against an in-memory database)
drizzle/            generated SQL migrations
docs/PLAN.md        architecture, data model and API plan
PROGRESS.md         build checklist and verification log
```

**Tests.** The wake engine is tested against real loopback UDP/TCP sockets: byte-exact packets, repeats, SecureOn, interface binding, partial failures. The integration tests call every exported route handler with real `Request` objects and assert that *each* protected route rejects anonymous callers (401), missing or wrong CSRF tokens (403) and cross-site requests (403).

**Windows with an Application Control policy** (corporate or locked-down machines) can block Next.js's native SWC binary, which Turbopack needs. Use `npm run dev:webpack` / `npm run build:webpack` there. This only affects the build tooling.

---

## Manual testing checklist on a real network

Automated tests cannot see your NICs and router. Work through this once on your own network (tick as you go). For each wake test use a computer you have already prepared with the in-app guide.

**Install & first run**
- [ ] Fresh start shows *Create your account*; with `SETUP_TOKEN` set, a wrong token is rejected.
- [ ] After creating the account you are signed in; reload keeps you signed in; Sign out → login page.
- [ ] A wrong password gives the same message as an unknown user; 8+ wrong attempts triggers the lockout message.

**Devices**
- [ ] Add a device using each MAC notation (`AA:BB:…`, `AA-BB-…`, `AABB.CCDD.EEFF`, plain hex). All save as `AA:BB:CC:DD:EE:FF`. Invalid ones show an error.
- [ ] Edit, duplicate (copy appears right after the original), reorder, delete.
- [ ] Search finds by name, address, MAC fragment and group. Group chips filter.

**Wake engine (on the ConnectWOL host, watch the wire)**
- [ ] `sudo tcpdump -ni any -X 'udp and (port 7 or port 9)'` while pressing the power button shows 3 datagrams of 102 bytes (106/108 with SecureOn), starting `ff ff ff ff ff ff`, to the subnet broadcast **and** `255.255.255.255`.
- [ ] On a host with several interfaces (Ethernet + Wi-Fi, VPN), the packet leaves from the interface that matches the computer's subnet.
- [ ] History shows each attempt; a failed attempt (disconnect the host's cable) shows a clear error.

**Actually waking (per computer)**
- [ ] From **sleep**: the computer wakes within ~30 s.
- [ ] From **hibernate**.
- [ ] From a full **shutdown** (Windows: Fast Startup off).
- [ ] Status check: with a status port set, the badge reads *No answer* while off, then *Online* shortly after waking.
- [ ] *Wake all* on a group wakes every member.
- [ ] Computer on another subnet: the *Broadcast address* override works.

**Remote**
- [ ] From a phone on mobile data via your VPN (Tailscale/WireGuard): open the app, wake a computer.
- [ ] Reverse proxy: HTTPS works, cookie is `Secure`, `TRUST_PROXY=true`; a second client gets its own rate-limit bucket.
- [ ] Port-forward + DDNS wake (*Another network*): works right after the computer sleeps. Retest after **30+ minutes** asleep, with and without a static ARP / IP–MAC binding (expect failure without it).

**PWA**
- [ ] Android Chrome/Edge: *Install app*. iOS Safari: *Add to Home Screen*. Launches full-screen with the icon.
- [ ] Stop the server: the installed app shows the “Can’t reach your server” page and *Try again* recovers when it is back.

**Backup & persistence**
- [ ] Export → delete all devices → Import: list restored in the same order. Importing the file twice adds nothing the second time.
- [ ] Restart the container/service: devices, history and login survive.
- [ ] Change the password: other signed-in browsers are signed out.

**Security spot checks**
- [ ] `curl -i -X POST http://host:3000/api/devices -H 'Content-Type: application/json' -d '{}'` → `401`.
- [ ] The same with a valid session cookie but no `X-CSRF-Token` → `403`.
- [ ] Browser dev-tools network tab: no requests to any other host.

---

## Known limitations

* **No delivery confirmation.** A sent packet is not a woken computer. Status checks are best-effort heuristics.
* **Wi-Fi targets** can rarely be woken, and almost never from a full shutdown. A shut-down **Mac** cannot be woken this way.
* **Docker Desktop** cannot send LAN broadcasts (see [above](#docker-desktop-windows--macos-limited)).
* **Broadcasts do not cross routers.** The server must be on the same subnet as the computer (or have an interface on it); a per-device broadcast override covers multi-subnet hosts. Routers rarely forward directed broadcasts.
* **Remote unicast to a sleeping computer** needs a static ARP / IP–MAC binding on the router, and a VPN is far simpler.
* **Single administrator**, no MFA.
* **Rate limiting is in memory** (per process, reset on restart). Without a reverse proxy, the server cannot see client IPs, so the per-client login throttle is effectively shared by everyone. The per-account failure lockout still applies.
* **SecureOn passwords** are stored unencrypted in the database and exported JSON (they travel in clear text inside the packet anyway).
* **Host names:** mDNS names (`pc.local`) often do not resolve from inside Docker or on minimal Linux installs. Use IP addresses (with a DHCP reservation).
* **IPv6:** magic packets use IPv4 broadcast (IPv6 has no broadcast). IPv6 unicast works in *Another network* mode.
* **PWA install and the service worker** need HTTPS or `localhost`. Plain `http://192.168.x.x` works as a website but not as an installable app.
* **Not verified here:** the Docker image build and behaviour on a real LAN were not exercised in the development environment (no Docker daemon, no sleeping computer). Use the checklist above.

---

## Privacy statement

ConnectWOL has **no accounts with any company, no analytics, no tracking, no ads and no cloud service.** Everything stays on the machine that runs it.

**Stored on your server:** your admin username and an Argon2id hash of your password; the computers you add (name, MAC, address, port, and optionally SecureOn password, icon, colour, group); a log of wake attempts (time, computer, result); your settings; session records (as hashes).

**Leaves your server:** only the magic packets you send and the optional TCP status probes to addresses you configured. No third-party scripts, fonts, images or trackers are loaded: the Content-Security-Policy forbids them.

**In your browser:** one HTTP-only session cookie; your theme and a few dismissed-hint flags in local storage; a service worker that caches the app's own static files (never your data).

**Your control:** export your computers as JSON, delete anything in the app, clear the history, or delete the data folder to erase everything.

The same text is shown in the app under **Settings → About**.
