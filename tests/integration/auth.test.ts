import { beforeEach, describe, expect, it } from 'vitest';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { POST as changePassword } from '@/app/api/auth/password/route';
import { GET as sessionInfo } from '@/app/api/auth/session/route';
import { POST as setup } from '@/app/api/auth/setup/route';
import { GET as listDevices } from '@/app/api/devices/route';
import { getDb } from '@/server/db';
import { sessions } from '@/server/db/schema';
import { ADMIN, call, resetApp, signedInClient, type Client } from '../helpers';

beforeEach(() => resetApp());

const doSetup = (client: Client, body: unknown = ADMIN, headers?: Record<string, string>) =>
  call(setup, { method: 'POST', path: '/api/auth/setup', body, client, headers });
const doLogin = (client: Client, body: unknown, headers?: Record<string, string>) =>
  call(login, { method: 'POST', path: '/api/auth/login', body, client, headers });

describe('first-run setup', () => {
  it('reports that setup is required, then creates the admin and signs in', async () => {
    const client: Client = {};
    const before = await call(sessionInfo, { client });
    expect(before.body).toEqual({ setupRequired: true, authenticated: false });

    const res = await doSetup(client);
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('admin');
    expect(typeof res.body.csrfToken).toBe('string');
    expect(client.cookie).toMatch(/^cwol_session=/);

    const after = await call(sessionInfo, { client });
    expect(after.body).toMatchObject({ setupRequired: false, authenticated: true, username: 'admin' });
    expect(after.body.csrfToken).toBe(res.body.csrfToken);
  });

  it('sets a hardened session cookie', async () => {
    const res = await doSetup({});
    const cookie = res.setCookies[0] ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=2592000/); // 30 days
    expect(cookie).not.toMatch(/Secure/); // plain-HTTP LAN access must keep working
  });

  it('refuses a second setup', async () => {
    await doSetup({});
    const again = await doSetup({}, { username: 'mallory', password: 'another long password' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('conflict');
  });

  it('only one of two simultaneous setups wins', async () => {
    const [a, b] = await Promise.all([
      doSetup({}, { username: 'first', password: 'long enough password' }),
      doSetup({}, { username: 'second', password: 'long enough password' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it('validates username and password', async () => {
    const short = await doSetup({}, { username: 'admin', password: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.error.code).toBe('validation_error');
    expect(short.body.error.fields.password).toMatch(/at least 10/);

    const badName = await doSetup({}, { username: 'a b', password: 'long enough password' });
    expect(badName.status).toBe(400);
    expect(badName.body.error.fields.username).toBeTruthy();

    const empty = await doSetup({}, {});
    expect(empty.status).toBe(400);
  });

  it('requires SETUP_TOKEN when configured', async () => {
    process.env.SETUP_TOKEN = 'let-me-in';
    const missing = await doSetup({});
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe('bad_setup_token');
    const wrong = await doSetup({}, { ...ADMIN, setupToken: 'nope' });
    expect(wrong.status).toBe(403);
    const ok = await doSetup({}, { ...ADMIN, setupToken: 'let-me-in' });
    expect(ok.status).toBe(201);
  });

  it('stores an Argon2id hash, never the password', async () => {
    await doSetup({});
    const row = getDb().$client.prepare('select password_hash from users').get() as { password_hash: string };
    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    expect(row.password_hash).not.toContain(ADMIN.password);
  });

  it('stores only a hash of the session token', async () => {
    const client: Client = {};
    await doSetup(client);
    const token = client.cookie!.split('=')[1]!;
    const row = getDb().$client.prepare('select id from sessions').get() as { id: string };
    expect(row.id).not.toBe(token);
    expect(row.id).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('login', () => {
  it('tells the client to run setup first when no admin exists', async () => {
    const res = await doLogin({}, ADMIN);
    expect(res.status).toBe(409);
  });

  it('signs in with the right credentials (username is case-insensitive)', async () => {
    await signedInClient();
    const client: Client = {};
    const res = await doLogin(client, { username: 'ADMIN', password: ADMIN.password });
    expect(res.status).toBe(200);
    expect(client.cookie).toMatch(/^cwol_session=/);
    const devices = await call(listDevices, { client, path: '/api/devices' });
    expect(devices.status).toBe(200);
  });

  it('gives the same answer for a wrong password and an unknown user', async () => {
    await signedInClient();
    const wrong = await doLogin({}, { username: 'admin', password: 'definitely wrong pw' });
    const unknown = await doLogin({}, { username: 'nobody', password: 'definitely wrong pw' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.setCookies).toEqual([]);
  });

  it('locks an account after repeated failures, even for the right password', async () => {
    await signedInClient();
    for (let i = 0; i < 8; i++) {
      expect((await doLogin({}, { username: 'admin', password: `wrong password ${i}` })).status).toBe(401);
    }
    const blocked = await doLogin({}, ADMIN);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('rate_limited');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('throttles per client regardless of the username tried', async () => {
    await signedInClient();
    let last = 0;
    for (let i = 0; i < 16; i++) {
      last = (await doLogin({}, { username: `user${i}`, password: 'x' })).status;
    }
    expect(last).toBe(429);
  });

  it('a successful login resets the failure counter', async () => {
    await signedInClient();
    for (let i = 0; i < 5; i++) await doLogin({}, { username: 'admin', password: `bad password ${i}` });
    expect((await doLogin({}, ADMIN)).status).toBe(200);
    for (let i = 0; i < 5; i++) {
      expect((await doLogin({}, { username: 'admin', password: `bad again ${i}` })).status).toBe(401);
    }
  });
});

describe('sessions, cookies and CSRF', () => {
  it('rejects requests without a session', async () => {
    const res = await call(listDevices, { path: '/api/devices' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('rejects garbage and forged session cookies', async () => {
    await signedInClient();
    for (const cookie of ['cwol_session=', 'cwol_session=abc', `cwol_session=${'a'.repeat(43)}`, 'cwol_session=%E0%A4%A']) {
      const res = await call(listDevices, { path: '/api/devices', client: { cookie } });
      expect(res.status).toBe(401);
    }
  });

  it('logout ends the session and clears the cookie', async () => {
    const client = await signedInClient();
    const token = client.cookie;
    const res = await call(logout, { method: 'POST', path: '/api/auth/logout', client });
    expect(res.status).toBe(200);
    expect(res.setCookies[0]).toMatch(/Max-Age=0/);
    expect(client.cookie).toBeUndefined();
    const reuse = await call(listDevices, { path: '/api/devices', client: { cookie: token } });
    expect(reuse.status).toBe(401);
  });

  it('logout needs the CSRF token while a session exists', async () => {
    const client = await signedInClient();
    const res = await call(logout, { method: 'POST', path: '/api/auth/logout', client, csrf: false });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('bad_csrf');
    // the session survives
    expect((await call(listDevices, { path: '/api/devices', client })).status).toBe(200);
  });

  it('logout without any session is harmless', async () => {
    const res = await call(logout, { method: 'POST', path: '/api/auth/logout' });
    expect(res.status).toBe(200);
  });

  it('expired sessions are rejected and deleted', async () => {
    const client = await signedInClient();
    getDb().update(sessions).set({ expiresAt: Date.now() - 1000 }).run();
    const res = await call(listDevices, { path: '/api/devices', client });
    expect(res.status).toBe(401);
    expect(getDb().$client.prepare('select count(*) n from sessions').get()).toEqual({ n: 0 });
  });

  it('slides the session and re-issues the cookie when it has been idle for a while', async () => {
    const client = await signedInClient();
    getDb().update(sessions).set({ lastSeenAt: Date.now() - 13 * 3600_000 }).run();
    const res = await call(listDevices, { path: '/api/devices', client });
    expect(res.status).toBe(200);
    expect(res.setCookies[0]).toMatch(/^cwol_session=.*Max-Age=2592000/);
    const again = await call(listDevices, { path: '/api/devices', client });
    expect(again.setCookies).toEqual([]);
  });

  it('marks the cookie Secure when the proxy says HTTPS and TRUST_PROXY is on', async () => {
    process.env.TRUST_PROXY = 'true';
    const res = await doSetup({}, ADMIN, { 'x-forwarded-proto': 'https' });
    expect(res.setCookies[0]).toMatch(/; Secure/);
  });

  it('ignores X-Forwarded-Proto when TRUST_PROXY is off', async () => {
    const res = await doSetup({}, ADMIN, { 'x-forwarded-proto': 'https' });
    expect(res.setCookies[0]).not.toMatch(/Secure/);
  });

  it('COOKIE_SECURE=true forces the Secure flag', async () => {
    process.env.COOKIE_SECURE = 'true';
    const res = await doSetup({});
    expect(res.setCookies[0]).toMatch(/; Secure/);
  });
});

describe('same-origin and content-type rules', () => {
  it('blocks cross-site browser requests (Sec-Fetch-Site)', async () => {
    const res = await doLogin({}, ADMIN, { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('bad_origin');
  });

  it('blocks same-site-but-cross-origin requests', async () => {
    const res = await doSetup({}, ADMIN, { 'sec-fetch-site': 'same-site' });
    expect(res.status).toBe(403);
  });

  it('allows same-origin browser requests', async () => {
    const res = await doSetup({}, ADMIN, { 'sec-fetch-site': 'same-origin', origin: 'http://localhost:3000' });
    expect(res.status).toBe(201);
  });

  it('falls back to comparing Origin with Host for older browsers', async () => {
    const bad = await doSetup({}, ADMIN, { origin: 'https://evil.example', host: 'localhost:3000' });
    expect(bad.status).toBe(403);
    expect(bad.body.error.message).toMatch(/TRUST_PROXY|ALLOWED_ORIGINS/);
    const good = await doSetup({}, ADMIN, { origin: 'http://localhost:3000', host: 'localhost:3000' });
    expect(good.status).toBe(201);
  });

  it('rejects the opaque "null" origin', async () => {
    const res = await doSetup({}, ADMIN, { origin: 'null' });
    expect(res.status).toBe(403);
  });

  it('honours ALLOWED_ORIGINS', async () => {
    process.env.ALLOWED_ORIGINS = 'https://wol.example.com/';
    const res = await doSetup({}, ADMIN, { origin: 'https://wol.example.com', 'sec-fetch-site': 'cross-site' });
    expect(res.status).toBe(201);
  });

  it('compares against X-Forwarded-Host only when the proxy is trusted', async () => {
    const headers = { origin: 'https://wol.example.com', host: 'internal:3000', 'x-forwarded-host': 'wol.example.com' };
    expect((await doSetup({}, ADMIN, headers)).status).toBe(403);
    resetApp();
    process.env.TRUST_PROXY = 'true';
    expect((await doSetup({}, ADMIN, headers)).status).toBe(201);
  });

  it('requires a JSON content type', async () => {
    const res = await call(setup, {
      method: 'POST',
      path: '/api/auth/setup',
      rawBody: 'username=admin&password=whatever12345',
      contentType: 'application/x-www-form-urlencoded',
    });
    expect(res.status).toBe(415);
    const none = await call(setup, { method: 'POST', path: '/api/auth/setup', rawBody: '{}', contentType: null });
    expect(none.status).toBe(415);
  });

  it('rejects malformed JSON and oversized bodies', async () => {
    const malformed = await call(setup, { method: 'POST', path: '/api/auth/setup', rawBody: '{not json' });
    expect(malformed.status).toBe(400);
    const huge = await call(setup, { method: 'POST', path: '/api/auth/setup', rawBody: JSON.stringify({ username: 'x'.repeat(100_000) }) });
    expect(huge.status).toBe(413);
  });
});

describe('password change', () => {
  const change = (client: Client, body: unknown) => call(changePassword, { method: 'POST', path: '/api/auth/password', client, body });

  it('needs the correct current password', async () => {
    const client = await signedInClient();
    const res = await change(client, { currentPassword: 'wrong wrong wrong', newPassword: 'a brand new password' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.currentPassword).toBeTruthy();
    // still signed in: a wrong password must not look like an expired session
    expect((await call(listDevices, { path: '/api/devices', client })).status).toBe(200);
  });

  it('validates the new password', async () => {
    const client = await signedInClient();
    const short = await change(client, { currentPassword: ADMIN.password, newPassword: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.error.fields.newPassword).toMatch(/at least 10/);
    const same = await change(client, { currentPassword: ADMIN.password, newPassword: ADMIN.password });
    expect(same.status).toBe(400);
  });

  it('switches the password and signs out other sessions but not this one', async () => {
    const client = await signedInClient();
    const other: Client = {};
    await doLogin(other, ADMIN);
    expect((await call(listDevices, { path: '/api/devices', client: other })).status).toBe(200);

    const res = await change(client, { currentPassword: ADMIN.password, newPassword: 'a brand new password' });
    expect(res.status).toBe(200);

    expect((await call(listDevices, { path: '/api/devices', client })).status).toBe(200);
    expect((await call(listDevices, { path: '/api/devices', client: other })).status).toBe(401);
    expect((await doLogin({}, ADMIN)).status).toBe(401);
    expect((await doLogin({}, { username: 'admin', password: 'a brand new password' })).status).toBe(200);
  });

  it('is rate limited', async () => {
    const client = await signedInClient();
    let last = 0;
    for (let i = 0; i < 6; i++) {
      last = (await change(client, { currentPassword: `wrong password ${i}`, newPassword: 'a brand new password' })).status;
    }
    expect(last).toBe(429);
  });
});
