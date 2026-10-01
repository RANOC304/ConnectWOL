import { beforeEach, describe, expect, it } from 'vitest';
import * as devicesRoute from '@/app/api/devices/route';
import * as deviceRoute from '@/app/api/devices/[id]/route';
import * as duplicateRoute from '@/app/api/devices/[id]/duplicate/route';
import * as reorderRoute from '@/app/api/devices/reorder/route';
import { call, resetApp, signedInClient, type Client } from '../helpers';

let client: Client;
beforeEach(async () => {
  resetApp();
  client = await signedInClient();
});

const create = (body: unknown) => call(devicesRoute.POST, { method: 'POST', path: '/api/devices', body, client });
const list = async () => (await call(devicesRoute.GET, { path: '/api/devices', client })).body.devices as Array<Record<string, any>>;
const get = (id: number | string) => call(deviceRoute.GET, { path: `/api/devices/${id}`, params: { id: String(id) }, client });
const patch = (id: number | string, body: unknown) =>
  call(deviceRoute.PATCH, { method: 'PATCH', path: `/api/devices/${id}`, params: { id: String(id) }, body, client });
const remove = (id: number | string) => call(deviceRoute.DELETE, { method: 'DELETE', path: `/api/devices/${id}`, params: { id: String(id) }, client });
const duplicate = (id: number) =>
  call(duplicateRoute.POST, { method: 'POST', path: `/api/devices/${id}/duplicate`, params: { id: String(id) }, client });
const reorder = (ids: number[]) => call(reorderRoute.POST, { method: 'POST', path: '/api/devices/reorder', body: { ids }, client });

const minimal = { name: 'Gaming PC', mac: 'aa-bb-cc-dd-ee-ff', target: '192.168.1.50' };

describe('create', () => {
  it('stores a device with normalised MAC and sensible defaults', async () => {
    const res = await create(minimal);
    expect(res.status).toBe(201);
    expect(res.body.device).toMatchObject({
      name: 'Gaming PC',
      mac: 'AA:BB:CC:DD:EE:FF',
      target: '192.168.1.50',
      port: 9,
      wakeMode: 'local',
      broadcast: null,
      secureOn: null,
      icon: null,
      color: null,
      groupName: null,
      statusPort: null,
      sortOrder: 0,
    });
    expect(res.body.device.id).toBeGreaterThan(0);
  });

  it('accepts every optional field', async () => {
    const res = await create({
      name: '  NAS  ',
      mac: 'AABB.CCDD.EEFF',
      target: 'nas.lan',
      port: '7',
      wakeMode: 'remote',
      broadcast: '192.168.1.255',
      secureOn: '11-22-33-44-55-66',
      icon: 'nas',
      color: 'teal',
      groupName: ' Home lab ',
      statusPort: 22,
    });
    expect(res.status).toBe(201);
    expect(res.body.device).toMatchObject({
      name: 'NAS',
      mac: 'AA:BB:CC:DD:EE:FF',
      port: 7,
      wakeMode: 'remote',
      broadcast: '192.168.1.255',
      secureOn: '11:22:33:44:55:66',
      icon: 'nas',
      color: 'teal',
      groupName: 'Home lab',
      statusPort: 22,
    });
  });

  it('treats blank optional strings as "not set"', async () => {
    const res = await create({ ...minimal, broadcast: '', secureOn: '  ', icon: '', color: '', groupName: '', statusPort: '' });
    expect(res.status).toBe(201);
    expect(res.body.device).toMatchObject({ broadcast: null, secureOn: null, icon: null, color: null, groupName: null, statusPort: null });
  });

  it('uses the configured default port when none is given', async () => {
    await call((await import('@/app/api/settings/route')).PUT, { method: 'PUT', path: '/api/settings', body: { defaultPort: 7 }, client });
    const res = await create(minimal);
    expect(res.body.device.port).toBe(7);
  });

  it('supports an unlimited number of devices', async () => {
    for (let i = 0; i < 150; i++) {
      const res = await create({ name: `PC ${i}`, mac: `02:00:00:00:${(i >> 8).toString(16).padStart(2, '0')}:${(i & 255).toString(16).padStart(2, '0')}`, target: '10.0.0.2' });
      expect(res.status).toBe(201);
    }
    const all = await list();
    expect(all).toHaveLength(150);
    expect(all.map((d) => d.sortOrder)).toEqual(Array.from({ length: 150 }, (_, i) => i));
  });

  const invalid: Array<[string, Record<string, unknown>, string]> = [
    ['missing name', { mac: minimal.mac, target: minimal.target }, 'name'],
    ['blank name', { ...minimal, name: '   ' }, 'name'],
    ['name too long', { ...minimal, name: 'x'.repeat(61) }, 'name'],
    ['control chars in name', { ...minimal, name: 'bad\u0000name' }, 'name'],
    ['bad MAC length', { ...minimal, mac: 'AA:BB:CC' }, 'mac'],
    ['bad MAC chars', { ...minimal, mac: 'GG:BB:CC:DD:EE:FF' }, 'mac'],
    ['mixed MAC separators', { ...minimal, mac: 'AA:BB-CC:DD-EE:FF' }, 'mac'],
    ['broadcast MAC', { ...minimal, mac: 'FF:FF:FF:FF:FF:FF' }, 'mac'],
    ['missing target', { name: 'x', mac: minimal.mac }, 'target'],
    ['target with spaces', { ...minimal, target: 'my pc' }, 'target'],
    ['target that is a URL', { ...minimal, target: 'http://pc.lan' }, 'target'],
    ['malformed IPv4 as target', { ...minimal, target: '999.1.1.1' }, 'target'],
    ['port 0', { ...minimal, port: 0 }, 'port'],
    ['port 65536', { ...minimal, port: 65536 }, 'port'],
    ['fractional port', { ...minimal, port: 9.5 }, 'port'],
    ['non-numeric port', { ...minimal, port: 'nine' }, 'port'],
    ['unknown mode', { ...minimal, wakeMode: 'cloud' }, 'wakeMode'],
    ['IPv6 broadcast', { ...minimal, broadcast: 'ff02::1' }, 'broadcast'],
    ['malformed broadcast', { ...minimal, broadcast: '192.168.1' }, 'broadcast'],
    ['SecureOn wrong length', { ...minimal, secureOn: '11:22:33' }, 'secureOn'],
    ['unknown icon', { ...minimal, icon: 'toaster' }, 'icon'],
    ['unknown colour', { ...minimal, color: 'chartreuse' }, 'color'],
    ['group too long', { ...minimal, groupName: 'g'.repeat(41) }, 'groupName'],
    ['status port out of range', { ...minimal, statusPort: 70000 }, 'statusPort'],
  ];

  it.each(invalid)('rejects %s', async (_label, body, field) => {
    const res = await create(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.fields).toHaveProperty(field);
    expect(await list()).toHaveLength(0);
  });

  it('rejects non-object bodies', async () => {
    for (const body of [null, 'text', 42, []]) {
      const res = await call(devicesRoute.POST, { method: 'POST', path: '/api/devices', rawBody: JSON.stringify(body), client });
      expect(res.status).toBe(400);
    }
  });

  it('accepts hostnames, IPv6 and trailing-dot FQDNs as targets', async () => {
    for (const target of ['desktop', 'desktop.lan', 'my-pc.example.com.', 'fe80::1', '2001:db8::7', 'pc_01.lan']) {
      const res = await create({ ...minimal, target });
      expect(res.status, target).toBe(201);
    }
  });

  it('ignores unknown and privileged-looking fields', async () => {
    const res = await create({ ...minimal, id: 999, sortOrder: 50, createdAt: 1, isAdmin: true });
    expect(res.status).toBe(201);
    expect(res.body.device.id).not.toBe(999);
    expect(res.body.device.sortOrder).toBe(0);
    expect(res.body.device).not.toHaveProperty('isAdmin');
  });

  it('stores hostile strings verbatim without breaking the query layer', async () => {
    const res = await create({ ...minimal, name: `Robert'); DROP TABLE devices;--`, groupName: '<script>alert(1)</script>' });
    expect(res.status).toBe(201);
    expect((await list())[0]).toMatchObject({ name: `Robert'); DROP TABLE devices;--`, groupName: '<script>alert(1)</script>' });
  });
});

describe('read, update, delete', () => {
  it('reads one device and 404s for unknown or malformed ids', async () => {
    const { device } = (await create(minimal)).body;
    expect((await get(device.id)).body.device.name).toBe('Gaming PC');
    expect((await get(9999)).status).toBe(404);
    for (const bad of ['abc', '0', '-1', '1.5', '1e3', '99999999999', '1;DROP']) {
      expect((await get(bad)).status, bad).toBe(404);
    }
  });

  it('applies partial updates without touching other fields', async () => {
    const { device } = (await create({ ...minimal, groupName: 'Office', icon: 'tower', port: 7 })).body;
    const res = await patch(device.id, { name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.device).toMatchObject({ name: 'Renamed', groupName: 'Office', icon: 'tower', port: 7, mac: 'AA:BB:CC:DD:EE:FF' });
    expect(res.body.device.updatedAt).toBeGreaterThanOrEqual(device.updatedAt);
  });

  it('can clear optional fields with blank values', async () => {
    const { device } = (await create({ ...minimal, groupName: 'Office', secureOn: '11:22:33:44', statusPort: 22 })).body;
    const res = await patch(device.id, { groupName: '', secureOn: '', statusPort: null });
    expect(res.status).toBe(200);
    expect(res.body.device).toMatchObject({ groupName: null, secureOn: null, statusPort: null });
  });

  it('re-validates and re-normalises on update', async () => {
    const { device } = (await create(minimal)).body;
    expect((await patch(device.id, { mac: 'nope' })).status).toBe(400);
    expect((await patch(device.id, { mac: 'aabbccddeeff' })).body.device.mac).toBe('AA:BB:CC:DD:EE:FF');
    expect((await patch(device.id, { name: '' })).status).toBe(400);
  });

  it('404s when updating or deleting a missing device', async () => {
    expect((await patch(123, { name: 'x' })).status).toBe(404);
    expect((await remove(123)).status).toBe(404);
  });

  it('deletes a device', async () => {
    const { device } = (await create(minimal)).body;
    expect((await remove(device.id)).status).toBe(200);
    expect((await get(device.id)).status).toBe(404);
    expect(await list()).toHaveLength(0);
  });
});

describe('duplicate and reorder', () => {
  const names = async () => (await list()).map((d) => d.name);

  it('duplicates a device right after the original', async () => {
    const a = (await create({ ...minimal, name: 'A', groupName: 'G', secureOn: '11:22:33:44' })).body.device;
    await create({ ...minimal, name: 'B' });
    await create({ ...minimal, name: 'C' });

    const res = await duplicate(a.id);
    expect(res.status).toBe(201);
    expect(res.body.device).toMatchObject({ name: 'A (copy)', groupName: 'G', secureOn: '11:22:33:44', mac: a.mac });
    expect(res.body.device.id).not.toBe(a.id);
    expect(await names()).toEqual(['A', 'A (copy)', 'B', 'C']);
    expect((await list()).map((d) => d.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it('keeps duplicated names within the length limit', async () => {
    const long = 'x'.repeat(60);
    const { device } = (await create({ ...minimal, name: long })).body;
    const copy = (await duplicate(device.id)).body.device;
    expect(copy.name.length).toBeLessThanOrEqual(60);
    expect(copy.name.endsWith(' (copy)')).toBe(true);
  });

  it('404s when duplicating a missing device', async () => {
    expect((await duplicate(404)).status).toBe(404);
  });

  it('reorders devices', async () => {
    const ids: number[] = [];
    for (const name of ['A', 'B', 'C', 'D']) ids.push((await create({ ...minimal, name })).body.device.id);
    const res = await reorder([ids[3]!, ids[1]!, ids[0]!, ids[2]!]);
    expect(res.status).toBe(200);
    expect(res.body.devices.map((d: any) => d.name)).toEqual(['D', 'B', 'A', 'C']);
    expect(await names()).toEqual(['D', 'B', 'A', 'C']);
  });

  it('keeps unlisted devices after the listed ones, in their old order', async () => {
    const ids: number[] = [];
    for (const name of ['A', 'B', 'C', 'D']) ids.push((await create({ ...minimal, name })).body.device.id);
    await reorder([ids[2]!]);
    expect(await names()).toEqual(['C', 'A', 'B', 'D']);
  });

  it('rejects unknown, duplicated or empty id lists', async () => {
    const { device } = (await create(minimal)).body;
    expect((await reorder([device.id, 9999])).status).toBe(400);
    expect((await reorder([device.id, device.id])).status).toBe(400);
    expect((await reorder([])).status).toBe(400);
    expect((await call(reorderRoute.POST, { method: 'POST', path: '/x', body: { ids: ['a'] }, client })).status).toBe(400);
  });

  it('new devices go to the end after reordering and deleting', async () => {
    const a = (await create({ ...minimal, name: 'A' })).body.device;
    await create({ ...minimal, name: 'B' });
    await remove(a.id);
    await create({ ...minimal, name: 'C' });
    expect(await names()).toEqual(['B', 'C']);
  });
});
