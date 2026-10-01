import { beforeEach, describe, expect, it } from 'vitest';
import * as devicesRoute from '@/app/api/devices/route';
import * as deviceRoute from '@/app/api/devices/[id]/route';
import * as exportRoute from '@/app/api/devices/export/route';
import * as importRoute from '@/app/api/devices/import/route';
import * as settingsRoute from '@/app/api/settings/route';
import { call, resetApp, signedInClient, type Client } from '../helpers';

let client: Client;
beforeEach(async () => {
  resetApp();
  client = await signedInClient();
});

const add = (body: Record<string, unknown>) => call(devicesRoute.POST, { method: 'POST', path: '/api/devices', body, client });
const list = async () => (await call(devicesRoute.GET, { path: '/api/devices', client })).body.devices as Array<Record<string, any>>;
const exportAll = () => call(exportRoute.GET, { path: '/api/devices/export', client });
const importBody = (body: unknown) => call(importRoute.POST, { method: 'POST', path: '/api/devices/import', body, client });

async function seed() {
  await add({ name: 'Desk', mac: 'aa:bb:cc:dd:ee:01', target: '192.168.1.10', icon: 'desktop', color: 'amber', groupName: 'Home', statusPort: 3389 });
  await add({ name: 'NAS', mac: 'aa:bb:cc:dd:ee:02', target: 'nas.lan', port: 7, secureOn: '11:22:33:44', icon: 'nas' });
  await add({ name: 'Remote', mac: 'aa:bb:cc:dd:ee:03', target: 'home.example.org', wakeMode: 'remote', broadcast: '10.0.0.255' });
}

describe('export', () => {
  it('produces a versioned JSON file without internal ids', async () => {
    await seed();
    const res = await exportAll();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="connectwol-devices-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ app: 'connectwol-devices', version: 1 });
    expect(new Date(res.body.exportedAt).toString()).not.toBe('Invalid Date');
    expect(res.body.devices.map((d: any) => d.name)).toEqual(['Desk', 'NAS', 'Remote']);
    for (const d of res.body.devices) {
      expect(d).not.toHaveProperty('id');
      expect(d).not.toHaveProperty('sortOrder');
    }
    expect(res.body.devices[1]).toMatchObject({ port: 7, secureOn: '11:22:33:44', icon: 'nas' });
  });

  it('exports an empty list', async () => {
    expect((await exportAll()).body.devices).toEqual([]);
  });
});

describe('import', () => {
  it('round-trips an export into an empty database', async () => {
    await seed();
    const backup = (await exportAll()).body;
    for (const d of await list()) {
      await call(deviceRoute.DELETE, { method: 'DELETE', path: `/api/devices/${d.id}`, params: { id: String(d.id) }, client });
    }
    expect(await list()).toHaveLength(0);

    const res = await importBody(backup);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ imported: 3, skipped: 0, replaced: false });

    const restored = await list();
    expect(restored.map((d) => d.name)).toEqual(['Desk', 'NAS', 'Remote']);
    const strip = ({ id: _i, createdAt: _c, updatedAt: _u, sortOrder: _s, ...rest }: Record<string, any>) => rest;
    expect(restored.map(strip)).toEqual(backup.devices);
  });

  it('skips devices that already exist (append mode is idempotent)', async () => {
    await seed();
    const backup = (await exportAll()).body;
    const res = await importBody(backup);
    expect(res.body).toMatchObject({ imported: 0, skipped: 3 });
    expect(await list()).toHaveLength(3);
  });

  it('appends only the new ones', async () => {
    await seed();
    const res = await importBody({ devices: [{ name: 'Desk', mac: 'AA:BB:CC:DD:EE:01', target: '192.168.1.10' }, { name: 'New', mac: 'AA:BB:CC:DD:EE:09', target: 'new.lan' }] });
    expect(res.body).toMatchObject({ imported: 1, skipped: 1 });
    expect((await list()).map((d) => d.name)).toEqual(['Desk', 'NAS', 'Remote', 'New']);
  });

  it('replace mode swaps the whole list', async () => {
    await seed();
    const res = await importBody({ mode: 'replace', devices: [{ name: 'Only', mac: 'AA:BB:CC:DD:EE:0F', target: '10.0.0.9' }] });
    expect(res.body).toMatchObject({ imported: 1, replaced: true });
    expect((await list()).map((d) => d.name)).toEqual(['Only']);
  });

  it('is all-or-nothing and points at the broken entries', async () => {
    await seed();
    const res = await importBody({
      mode: 'replace',
      devices: [
        { name: 'Fine', mac: 'AA:BB:CC:DD:EE:0A', target: '10.0.0.9' },
        { name: 'Bad MAC', mac: 'ZZ', target: '10.0.0.10' },
        { name: '', mac: 'AA:BB:CC:DD:EE:0B', target: 'x y' },
        'not an object',
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/3 of 4 entries are invalid/);
    expect(Object.keys(res.body.error.fields)).toEqual(
      expect.arrayContaining(['devices.1.mac', 'devices.2.name', 'devices.2.target', 'devices.3._']),
    );
    // nothing changed, not even in replace mode
    expect((await list()).map((d) => d.name)).toEqual(['Desk', 'NAS', 'Remote']);
  });

  it('accepts hand-written files: mixed MAC notations, missing optional fields, unknown keys', async () => {
    const res = await importBody({
      devices: [
        { name: 'A', mac: 'aabbccddee0a', target: '10.0.0.1', id: 77, extra: true },
        { name: 'B', mac: 'AA-BB-CC-DD-EE-0B', target: '10.0.0.2', port: '7' },
      ],
    });
    expect(res.status).toBe(200);
    expect((await list()).map((d) => [d.mac, d.port])).toEqual([
      ['AA:BB:CC:DD:EE:0A', 9],
      ['AA:BB:CC:DD:EE:0B', 7],
    ]);
  });

  it('rejects things that are not exports', async () => {
    for (const body of [{}, { devices: 'nope' }, { devices: {} }, [], 'text', { devices: [], mode: 'merge' }]) {
      const res = await call(importRoute.POST, { method: 'POST', path: '/x', rawBody: JSON.stringify(body), client });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('caps the number of entries and the body size', async () => {
    const tooMany = await importBody({ devices: Array.from({ length: 5001 }, () => ({})) });
    expect(tooMany.status).toBe(400);
    const huge = await call(importRoute.POST, {
      method: 'POST',
      path: '/api/devices/import',
      rawBody: JSON.stringify({ devices: [], pad: 'x'.repeat(6 * 1024 * 1024) }),
      client,
    });
    expect(huge.status).toBe(413);
  });

  it('imports thousands of devices', async () => {
    const devices = Array.from({ length: 2000 }, (_, i) => ({
      name: `Host ${i}`,
      mac: `02:00:00:00:${(i >> 8).toString(16).padStart(2, '0')}:${(i & 255).toString(16).padStart(2, '0')}`,
      target: `10.1.${i >> 8}.${i & 255}`,
    }));
    const res = await importBody({ devices });
    expect(res.body).toMatchObject({ imported: 2000, skipped: 0 });
    expect(await list()).toHaveLength(2000);
  });
});

describe('settings', () => {
  const get = () => call(settingsRoute.GET, { path: '/api/settings', client });
  const put = (body: unknown) => call(settingsRoute.PUT, { method: 'PUT', path: '/api/settings', body, client });

  it('starts with defaults', async () => {
    expect((await get()).body).toEqual({ settings: { defaultPort: 9, repeatCount: 3 } });
  });

  it('updates fields independently and persists them', async () => {
    expect((await put({ repeatCount: 5 })).body.settings).toEqual({ defaultPort: 9, repeatCount: 5 });
    expect((await put({ defaultPort: '7' })).body.settings).toEqual({ defaultPort: 7, repeatCount: 5 });
    expect((await get()).body.settings).toEqual({ defaultPort: 7, repeatCount: 5 });
  });

  it('validates ranges', async () => {
    for (const body of [{ repeatCount: 0 }, { repeatCount: 11 }, { repeatCount: 1.5 }, { defaultPort: 0 }, { defaultPort: 65536 }, { defaultPort: 'x' }]) {
      const res = await put(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await get()).body.settings).toEqual({ defaultPort: 9, repeatCount: 3 });
  });

  it('ignores unknown keys instead of storing them', async () => {
    const res = await put({ repeatCount: 2, theme: 'dark', evil: 'x' });
    expect(res.body.settings).toEqual({ defaultPort: 9, repeatCount: 2 });
  });
});
