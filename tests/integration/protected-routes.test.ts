import { beforeEach, describe, expect, it } from 'vitest';
import { GET as health } from '@/app/api/health/route';
import { POST as changePassword } from '@/app/api/auth/password/route';
import * as devices from '@/app/api/devices/route';
import * as device from '@/app/api/devices/[id]/route';
import * as duplicate from '@/app/api/devices/[id]/duplicate/route';
import * as deviceWake from '@/app/api/devices/[id]/wake/route';
import * as exportRoute from '@/app/api/devices/export/route';
import * as importRoute from '@/app/api/devices/import/route';
import * as reorder from '@/app/api/devices/reorder/route';
import * as status from '@/app/api/devices/status/route';
import * as history from '@/app/api/history/route';
import * as settings from '@/app/api/settings/route';
import * as wake from '@/app/api/wake/route';
import { call, resetApp, signedInClient } from '../helpers';

beforeEach(() => resetApp());

interface Case {
  name: string;
  handler: unknown;
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

// Every authenticated endpoint of the API. Adding a route without listing it here is a review smell.
const protectedRoutes: Case[] = [
  { name: 'GET /api/devices', handler: devices.GET, method: 'GET', path: '/api/devices' },
  { name: 'POST /api/devices', handler: devices.POST, method: 'POST', path: '/api/devices', body: { name: 'a', mac: 'AA:BB:CC:DD:EE:FF', target: '10.0.0.2' } },
  { name: 'GET /api/devices/:id', handler: device.GET, method: 'GET', path: '/api/devices/1', params: { id: '1' } },
  { name: 'PATCH /api/devices/:id', handler: device.PATCH, method: 'PATCH', path: '/api/devices/1', params: { id: '1' }, body: { name: 'b' } },
  { name: 'DELETE /api/devices/:id', handler: device.DELETE, method: 'DELETE', path: '/api/devices/1', params: { id: '1' } },
  { name: 'POST /api/devices/:id/duplicate', handler: duplicate.POST, method: 'POST', path: '/api/devices/1/duplicate', params: { id: '1' } },
  { name: 'POST /api/devices/:id/wake', handler: deviceWake.POST, method: 'POST', path: '/api/devices/1/wake', params: { id: '1' } },
  { name: 'POST /api/wake', handler: wake.POST, method: 'POST', path: '/api/wake', body: { ids: [1] } },
  { name: 'POST /api/devices/reorder', handler: reorder.POST, method: 'POST', path: '/api/devices/reorder', body: { ids: [1] } },
  { name: 'POST /api/devices/status', handler: status.POST, method: 'POST', path: '/api/devices/status', body: {} },
  { name: 'GET /api/devices/export', handler: exportRoute.GET, method: 'GET', path: '/api/devices/export' },
  { name: 'POST /api/devices/import', handler: importRoute.POST, method: 'POST', path: '/api/devices/import', body: { devices: [] } },
  { name: 'GET /api/history', handler: history.GET, method: 'GET', path: '/api/history' },
  { name: 'DELETE /api/history', handler: history.DELETE, method: 'DELETE', path: '/api/history' },
  { name: 'GET /api/settings', handler: settings.GET, method: 'GET', path: '/api/settings' },
  { name: 'PUT /api/settings', handler: settings.PUT, method: 'PUT', path: '/api/settings', body: { repeatCount: 2 } },
  { name: 'POST /api/auth/password', handler: changePassword, method: 'POST', path: '/api/auth/password', body: { currentPassword: 'x', newPassword: 'y' } },
];

describe('every protected route', () => {
  it.each(protectedRoutes)('$name rejects anonymous callers with 401', async (route) => {
    const res = await call(route.handler, { method: route.method, path: route.path, params: route.params, body: route.body });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  const mutating = protectedRoutes.filter((r) => r.method !== 'GET');

  it.each(mutating)('$name rejects a signed-in caller without the CSRF token (403)', async (route) => {
    const client = await signedInClient();
    const res = await call(route.handler, {
      method: route.method,
      path: route.path,
      params: route.params,
      body: route.body,
      client,
      csrf: false,
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('bad_csrf');
  });

  it.each(mutating)('$name rejects a wrong CSRF token (403)', async (route) => {
    const client = await signedInClient();
    const res = await call(route.handler, {
      method: route.method,
      path: route.path,
      params: route.params,
      body: route.body,
      client,
      csrf: 'not-the-token',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('bad_csrf');
  });

  it.each(mutating)('$name rejects cross-site requests even with a valid session (403)', async (route) => {
    const client = await signedInClient();
    const res = await call(route.handler, {
      method: route.method,
      path: route.path,
      params: route.params,
      body: route.body,
      client,
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('bad_origin');
  });

  it('a CSRF token from another session is not accepted', async () => {
    const a = await signedInClient();
    resetApp();
    const b = await signedInClient();
    const res = await call(devices.POST, {
      method: 'POST',
      path: '/api/devices',
      client: b,
      csrf: a.csrf,
      body: { name: 'a', mac: 'AA:BB:CC:DD:EE:FF', target: '10.0.0.2' },
    });
    expect(res.status).toBe(403);
  });
});

describe('public endpoints', () => {
  it('health is reachable without a session and leaks nothing', async () => {
    const res = await call(health);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, app: 'ConnectWOL' });
  });

  it('API responses are never cacheable', async () => {
    const res = await call(devices.GET, { path: '/api/devices' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
