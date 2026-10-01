# Progress

Legend: `[x]` done and verified · `[~]` done but not verifiable in this environment · `[ ]` not done

Plan, data model and API: see [docs/PLAN.md](docs/PLAN.md).

## Stage 0 – Scaffold
- [x] package.json, tsconfig (strict + noUncheckedIndexedAccess), next.config (standalone, CSP/security headers), eslint, vitest, .gitignore, .env.example
- [x] Library APIs checked against installed versions (Next 16.3.8 docs in node_modules, Drizzle 0.45 typings, better-sqlite3 13, @node-rs/argon2 2.2, zod 4.6)
- [x] TypeScript pinned to 5.9 and ESLint to 9 (typescript-eslint / eslint-config-next do not yet support TS 7 / ESLint 10)

## Stage 1 – Wake engine
- [x] MAC parser/normaliser: 5 notations + macOS short groups, rejects mixed separators, bad chars, wrong lengths, all-zero/broadcast
- [x] Magic packet builder incl. 4- and 6-byte SecureOn (102/106/108 bytes)
- [x] Destination planning: derived/explicit broadcast, per-interface binding, multi-NIC, remote unicast with DNS
- [x] UDP sender with repeats, tested against real loopback sockets
- [x] TCP status probe (connected / refused / timeout / DNS failure)

## Stage 2 – Database & auth
- [x] Drizzle schema + generated migration (`drizzle/0000_init.sql`), lazy open + auto-migrate
- [x] Argon2id, hashed session tokens, cookies, CSRF + same-origin checks, in-memory rate limiter

## Stage 3 – API
- [x] Route wrapper (origin → session → CSRF → rate limit → zod → uniform errors)
- [x] Auth, devices (CRUD, duplicate, reorder), wake (single / group / ids), status, history, settings, import/export, health
- [x] Integration tests for every protected route (401 anonymous, 403 no/bad CSRF, 403 cross-site)

## Stage 4 – Device UI
- [x] Design tokens (light/dark), base + component CSS, responsive shell (bottom tabs ↔ sidebar), logo, icon set
- [x] Login + first-run setup
- [x] Device list: search, group chips, wake-all-in-group, wake animation, honest result messages, live status polling after a wake
- [x] Add / edit (live MAC feedback) / duplicate / delete / reorder; empty state and guide banner
- [x] Checked in a real browser: setup → add device → wake (listener received 3 × 106-byte packets) → status badge; mobile + light + dark

## Stage 5 – Setup wizard
- [x] 7 steps with original SVG diagrams / mock screens, OS tabs, copyable commands, persisted checklists
- [x] Step 6 embeds a real test-wake widget with status watching
- [x] Troubleshooting section; guide index with remembered progress; any step reopenable

## Stage 6 – Settings & backup
- [x] Theme (system/light/dark), default port, repeat count, password change, sign out
- [x] Import / export UI (append or replace, all-or-nothing)
- [x] History page, About + privacy statement

## Stage 7 – Packaging
- [x] PWA manifest, generated icons (dependency-free script), service worker + offline page
- [x] Service-worker policy verified by unit tests in a sandbox (no API/HTML caching, offline fallback)
- [~] Service-worker *registration* could not be observed: the embedded browser used for UI checks refuses to register even a one-line worker
- [x] Dockerfile + docker-compose.yml (host networking) + docker-compose.desktop.yml; compose files validated with `docker compose config`
- [~] Docker **image build** not run: no Docker daemon available here. Standalone output was verified instead (native modules, migrations, headers; started from its own directory like the image does)
- [x] README (install, first run, Tailscale/WireGuard/reverse proxy, why not serverless, manual test checklist, limitations, privacy)

## Verification log (latest run)
- `npm run typecheck`: clean
- `npm run lint`: clean
- `npm test`: 385 tests across 14 files, all passing
- `next build --webpack`: succeeds (Turbopack is blocked on this machine by an Application Control policy that stops the native SWC binary loading)
- Contrast: every text/UI colour pair in both themes meets WCAG AA (enforced by `tests/unit/contrast.test.ts`)
- Not verifiable here: waking real hardware, Docker image build, multi-NIC/VLAN behaviour, PWA install. Covered by the manual checklist in the README.
