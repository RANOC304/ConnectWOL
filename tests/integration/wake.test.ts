import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as devicesRoute from '@/app/api/devices/route';
import * as deviceWake from '@/app/api/devices/[id]/wake/route';
import * as statusRoute from '@/app/api/devices/status/route';
import * as historyRoute from '@/app/api/history/route';
import * as settingsRoute from '@/app/api/settings/route';
import * as wakeRoute from '@/app/api/wake/route';
import { call, resetApp, signedInClient, tcpListener, udpListener, type Client } from '../helpers';

let client: Client;
const closers: Array<() => Promise<void>> = [];

beforeEach(async () => {
  resetApp();
  client = await signedInClient();
});
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

async function listener() {
  const l = await udpListener();
  closers.push(l.close);
  return l;
}

const setRepeat = (repeatCount: number) =>
  call(settingsRoute.PUT, { method: 'PUT', path: '/api/settings', body: { repeatCount }, client });

const addDevice = async (body: Record<string, unknown>) => {
  const res = await call(devicesRoute.POST, { method: 'POST', path: '/api/devices', body, client });
  expect(res.status).toBe(201);
  return res.body.device as { id: number; mac: string };
};

const wakeOne = (id: number) =>
  call(deviceWake.POST, { method: 'POST', path: `/api/devices/${id}/wake`, params: { id: String(id) }, client });
const wakeMany = (body: unknown) => call(wakeRoute.POST, { method: 'POST', path: '/api/wake', body, client });
const history = (query = '') => call(historyRoute.GET, { path: `/api/history${query}`, client });

/** A device the test can observe: remote mode = unicast to the loopback listener. */
const observable = (l: { port: number }, extra: Record<string, unknown> = {}) => ({
  name: 'Observable',
  mac: '00:1A:2B:3C:4D:5E',
  target: '127.0.0.1',
  port: l.port,
  wakeMode: 'remote',
  ...extra,
});

describe('waking one device', () => {
  it('sends the magic packet the configured number of times and says only "sent"', async () => {
    const udp = await listener();
    await setRepeat(2);
    const { id } = await addDevice(observable(udp));

    const res = await wakeOne(id);
    await udp.waitFor(2);

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({
      deviceId: id,
      result: 'sent',
      repeat: 2,
      packetBytes: 102,
      destinations: [`127.0.0.1:${udp.port}`],
    });
    expect(res.body.result.detail).toMatch(/^Sent 2×/);
    expect(res.body.result.detail).not.toMatch(/woke|awake|online|success/i);

    expect(udp.received).toHaveLength(2);
    const packet = udp.received[0]!;
    expect(packet.length).toBe(102);
    expect(packet.subarray(0, 6).toString('hex')).toBe('ffffffffffff');
    for (let i = 0; i < 16; i++) expect(packet.subarray(6 + i * 6, 12 + i * 6).toString('hex')).toBe('001a2b3c4d5e');
  });

  it('appends the SecureOn password', async () => {
    const udp = await listener();
    await setRepeat(1);
    const { id } = await addDevice(observable(udp, { secureOn: 'AA:BB:CC:DD:EE:FF' }));
    await wakeOne(id);
    await udp.waitFor(1);
    expect(udp.received[0]!.length).toBe(108);
    expect(udp.received[0]!.subarray(102).toString('hex')).toBe('aabbccddeeff');
  });

  it('works for devices saved with any MAC notation', async () => {
    const udp = await listener();
    await setRepeat(1);
    const { id } = await addDevice(observable(udp, { mac: '001a.2b3c.4d5e' }));
    await wakeOne(id);
    await udp.waitFor(1);
    expect(udp.received[0]!.subarray(6, 12).toString('hex')).toBe('001a2b3c4d5e');
  });

  it('logs every attempt to the history', async () => {
    const udp = await listener();
    await setRepeat(1);
    const { id } = await addDevice(observable(udp));
    await wakeOne(id);
    await wakeOne(id);

    const log = await history();
    expect(log.body.total).toBe(2);
    expect(log.body.items[0]).toMatchObject({
      deviceId: id,
      deviceName: 'Observable',
      mac: '00:1A:2B:3C:4D:5E',
      mode: 'remote',
      result: 'sent',
      repeat: 1,
      destinations: [`127.0.0.1:${udp.port}`],
    });
    expect(log.body.items[0].createdAt).toBeGreaterThanOrEqual(log.body.items[1].createdAt);
  });

  it('reports a failed attempt (and logs it) when the host cannot be resolved', async () => {
    await setRepeat(1);
    // a name that the validator accepts but that is not a real host; `.invalid` is reserved (RFC 2606)
    const { id } = await addDevice({ name: 'Ghost', mac: 'AA:BB:CC:DD:EE:01', target: 'ghost.invalid', wakeMode: 'remote' });
    const res = await wakeOne(id);
    expect(res.status).toBe(200);
    expect(res.body.result.result).toBe('failed');
    expect(res.body.result.detail).toMatch(/resolve|ghost\.invalid/i);
    expect((await history()).body.items[0]).toMatchObject({ result: 'failed', deviceName: 'Ghost' });
  });

  it('404s for an unknown device', async () => {
    expect((await wakeOne(4242)).status).toBe(404);
    expect((await wakeOne('abc' as unknown as number)).status).toBe(404);
  });

  it('rate limits waking per session', async () => {
    const udp = await listener();
    await setRepeat(1);
    const { id } = await addDevice(observable(udp));
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await wakeOne(id)).status;
    expect(last).toBe(429);
  });

  it('local mode sends from this host to the LAN broadcast without throwing', async () => {
    await setRepeat(1);
    const { id } = await addDevice({ name: 'LAN box', mac: 'AA:BB:CC:DD:EE:02', target: '192.168.77.10', wakeMode: 'local' });
    const res = await wakeOne(id);
    expect(res.status).toBe(200);
    // Real network access varies by machine; the contract is a well-formed outcome either way.
    expect(['sent', 'partial', 'failed']).toContain(res.body.result.result);
    expect(res.body.result.destinations.join(' ')).toContain('255.255.255.255:9');
  });
});

describe('waking many devices', () => {
  it('wakes every device of a group (case-insensitive) and nothing else', async () => {
    const udp = await listener();
    await setRepeat(1);
    await addDevice(observable(udp, { name: 'A', mac: '02:00:00:00:00:0A', groupName: 'Office' }));
    await addDevice(observable(udp, { name: 'B', mac: '02:00:00:00:00:0B', groupName: 'office' }));
    await addDevice(observable(udp, { name: 'C', mac: '02:00:00:00:00:0C', groupName: 'Lab' }));
    await addDevice(observable(udp, { name: 'D', mac: '02:00:00:00:00:0D' }));

    const res = await wakeMany({ group: 'OFFICE' });
    await udp.waitFor(2);

    expect(res.status).toBe(200);
    expect(res.body.results.map((r: any) => r.deviceName)).toEqual(['A', 'B']);
    expect(udp.received.map((p) => p.subarray(6, 12).toString('hex')).sort()).toEqual(['02000000000a', '02000000000b']);
    expect((await history()).body.total).toBe(2);
  });

  it('wakes an explicit set of ids, skipping ids that no longer exist', async () => {
    const udp = await listener();
    await setRepeat(1);
    const a = await addDevice(observable(udp, { name: 'A', mac: '02:00:00:00:00:0A' }));
    const b = await addDevice(observable(udp, { name: 'B', mac: '02:00:00:00:00:0B' }));
    const res = await wakeMany({ ids: [b.id, 9999, a.id] });
    expect(res.status).toBe(200);
    expect(res.body.results.map((r: any) => r.deviceName)).toEqual(['B', 'A']);
  });

  it('copes with a large group', async () => {
    const udp = await listener();
    await setRepeat(1);
    for (let i = 0; i < 40; i++) {
      await addDevice(observable(udp, { name: `PC ${i}`, mac: `02:00:00:00:01:${i.toString(16).padStart(2, '0')}`, groupName: 'Lab' }));
    }
    const res = await wakeMany({ group: 'Lab' });
    await udp.waitFor(40);
    expect(res.body.results).toHaveLength(40);
    expect(res.body.results.every((r: any) => r.result === 'sent')).toBe(true);
    expect(new Set(udp.received.map((p) => p.subarray(6, 12).toString('hex'))).size).toBe(40);
  });

  it('404s for a group with no devices and 400s when nothing selected exists', async () => {
    expect((await wakeMany({ group: 'Nowhere' })).status).toBe(404);
    expect((await wakeMany({ ids: [1, 2] })).status).toBe(400);
  });

  it('validates the payload', async () => {
    for (const body of [{}, { ids: [] }, { ids: ['1'] }, { ids: [1, 1] }, { group: '' }, { group: 'x'.repeat(41) }, { ids: Array.from({ length: 1001 }, (_, i) => i + 1) }]) {
      expect((await wakeMany(body)).status, JSON.stringify(body).slice(0, 40)).toBe(400);
    }
  });
});

describe('status check (best effort)', () => {
  const probe = (body: unknown = {}) => call(statusRoute.POST, { method: 'POST', path: '/api/devices/status', body, client });

  it('reports online for a reachable port and omits devices without a status port', async () => {
    const tcp = await tcpListener();
    closers.push(tcp.close);
    const withPort = await addDevice({ name: 'Up', mac: '02:00:00:00:00:01', target: '127.0.0.1', statusPort: tcp.port });
    await addDevice({ name: 'No port', mac: '02:00:00:00:00:02', target: '127.0.0.1' });

    const res = await probe();
    expect(res.status).toBe(200);
    expect(res.body.statuses).toHaveLength(1);
    expect(res.body.statuses[0]).toMatchObject({ deviceId: withPort.id, state: 'online' });
    expect(res.body.statuses[0].checkedAt).toBeGreaterThan(0);
  });

  it('can be limited to specific ids', async () => {
    const tcp = await tcpListener();
    closers.push(tcp.close);
    const a = await addDevice({ name: 'A', mac: '02:00:00:00:00:01', target: '127.0.0.1', statusPort: tcp.port });
    await addDevice({ name: 'B', mac: '02:00:00:00:00:02', target: '127.0.0.1', statusPort: tcp.port });
    const res = await probe({ ids: [a.id] });
    expect(res.body.statuses.map((s: any) => s.deviceId)).toEqual([a.id]);
  });

  it('treats a closed port on a live host as "answered"', async () => {
    const tcp = await tcpListener();
    const port = tcp.port;
    await tcp.close();
    await addDevice({ name: 'Closed', mac: '02:00:00:00:00:03', target: '127.0.0.1', statusPort: port });
    const res = await probe();
    expect(res.body.statuses[0].state).toBe('online');
    expect(res.body.statuses[0].via).toBe('refused');
    expect(res.body.statuses[0].detail).toMatch(/nothing is listening/);
  });

  it('validates ids', async () => {
    expect((await probe({ ids: ['x'] })).status).toBe(400);
  });
});

describe('history', () => {
  it('pages, orders newest first, survives device deletion, and can be cleared', async () => {
    const udp = await listener();
    await setRepeat(1);
    const a = await addDevice(observable(udp, { name: 'Doomed' }));
    for (let i = 0; i < 5; i++) await wakeOne(a.id);

    await call((await import('@/app/api/devices/[id]/route')).DELETE, {
      method: 'DELETE',
      path: `/api/devices/${a.id}`,
      params: { id: String(a.id) },
      client,
    });

    const page1 = await history('?limit=2&offset=0');
    expect(page1.body.total).toBe(5);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0].deviceName).toBe('Doomed');
    const page3 = await history('?limit=2&offset=4');
    expect(page3.body.items).toHaveLength(1);
    expect(new Set([...page1.body.items, ...page3.body.items].map((i: any) => i.id)).size).toBe(3);

    const cleared = await call(historyRoute.DELETE, { method: 'DELETE', path: '/api/history', client });
    expect(cleared.body).toEqual({ cleared: 5 });
    expect((await history()).body).toEqual({ items: [], total: 0 });
  });

  it('validates paging parameters', async () => {
    for (const q of ['?limit=0', '?limit=201', '?limit=abc', '?offset=-1']) {
      expect((await history(q)).status, q).toBe(400);
    }
  });
});
