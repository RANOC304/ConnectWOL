import dgram from 'node:dgram';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMagicPacket } from '@/server/wol/packet';
import { executePlan } from '@/server/wol/send';
import { wakeDevice } from '@/server/wol/wake';
import type { WakePlan } from '@/server/wol/plan';

interface Listener {
  port: number;
  received: Buffer[];
  close: () => Promise<void>;
  waitFor: (count: number, timeoutMs?: number) => Promise<void>;
}

const open: Listener[] = [];

async function listen(): Promise<Listener> {
  const socket = dgram.createSocket('udp4');
  const received: Buffer[] = [];
  socket.on('message', (msg) => received.push(Buffer.from(msg)));
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  const listener: Listener = {
    port: (socket.address() as AddressInfo).port,
    received,
    close: () => new Promise((resolve) => socket.close(() => resolve())),
    waitFor: async (count, timeoutMs = 2000) => {
      const deadline = Date.now() + timeoutMs;
      while (received.length < count && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    },
  };
  open.push(listener);
  return listener;
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((l) => l.close().catch(() => undefined)));
});

const MAC = '00:1A:2B:3C:4D:5E';

describe('executePlan (real loopback UDP)', () => {
  it('delivers the packet `repeat` times, byte for byte', async () => {
    const server = await listen();
    const packet = buildMagicPacket(MAC);
    const plan: WakePlan = { mode: 'remote', port: server.port, attempts: [{ to: '127.0.0.1', family: 4 }], notes: [] };

    const results = await executePlan(plan, packet, { repeat: 3, delayMs: 5 });
    await server.waitFor(3);

    expect(results).toEqual([{ from: undefined, to: '127.0.0.1', ok: true, sent: 3 }]);
    expect(server.received).toHaveLength(3);
    for (const datagram of server.received) {
      expect(datagram.length).toBe(102);
      expect(datagram.equals(packet)).toBe(true);
    }
  });

  it('can pin the socket to a local interface address', async () => {
    const server = await listen();
    const plan: WakePlan = {
      mode: 'local',
      port: server.port,
      attempts: [{ from: '127.0.0.1', to: '127.0.0.1', family: 4 }],
      notes: [],
    };
    const results = await executePlan(plan, buildMagicPacket(MAC, '11:22:33:44:55:66'), { repeat: 1, delayMs: 0 });
    await server.waitFor(1);
    expect(results[0]).toMatchObject({ ok: true, from: '127.0.0.1' });
    expect(server.received[0]?.length).toBe(108);
  });

  it('reports a destination whose interface does not exist instead of throwing', async () => {
    const plan: WakePlan = {
      mode: 'local',
      port: 9,
      attempts: [{ from: '203.0.113.77', to: '203.0.113.255', family: 4 }],
      notes: [],
    };
    const results = await executePlan(plan, buildMagicPacket(MAC), { repeat: 2, delayMs: 0 });
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.sent).toBe(0);
    expect(results[0]?.error).toMatch(/Could not open a UDP socket on 203\.0\.113\.77/);
  });

  it('keeps going when one group fails and another works', async () => {
    const server = await listen();
    const plan: WakePlan = {
      mode: 'local',
      port: server.port,
      attempts: [
        { from: '203.0.113.77', to: '203.0.113.255', family: 4 },
        { to: '127.0.0.1', family: 4 },
      ],
      notes: [],
    };
    const results = await executePlan(plan, buildMagicPacket(MAC), { repeat: 1, delayMs: 0 });
    await server.waitFor(1);
    expect(results.map((r) => r.ok)).toEqual([false, true]);
    expect(server.received).toHaveLength(1);
  });

  it('actually sets SO_BROADCAST (sending to a broadcast address is not refused)', async () => {
    // 255.255.255.255 on a machine with no network can legitimately fail (ENETUNREACH), but it
    // must never fail with EACCES, which is what an un-enabled broadcast socket produces.
    const plan: WakePlan = { mode: 'local', port: 9, attempts: [{ to: '255.255.255.255', family: 4 }], notes: [] };
    const [result] = await executePlan(plan, buildMagicPacket(MAC), { repeat: 1, delayMs: 0 });
    if (!result?.ok) expect(result?.error).not.toMatch(/EACCES/);
  });
});

describe('wakeDevice', () => {
  const baseDeps = { interfaces: [], lookup: async () => ['127.0.0.1'] };

  it('remote mode: resolves the host and sends unicast', async () => {
    const server = await listen();
    const outcome = await wakeDevice(
      { mac: 'aa-bb-cc-dd-ee-ff', target: 'ddns.example.test', port: server.port, wakeMode: 'remote' },
      { repeat: 2, delayMs: 5 },
      baseDeps,
    );
    await server.waitFor(2);
    expect(outcome.result).toBe('sent');
    expect(outcome.destinations).toEqual([`127.0.0.1:${server.port}`]);
    expect(outcome.packetBytes).toBe(102);
    expect(outcome.detail).toMatch(/^Sent 2×/);
    expect(outcome.detail).not.toMatch(/woke|awake|online/i);
    expect(server.received).toHaveLength(2);
    expect(server.received[0]?.subarray(6, 12).toString('hex')).toBe('aabbccddeeff');
  });

  it('includes the SecureOn password', async () => {
    const server = await listen();
    const outcome = await wakeDevice(
      { mac: MAC, target: '127.0.0.1', port: server.port, wakeMode: 'remote', secureOn: '01:02:03:04' },
      { repeat: 1, delayMs: 0 },
      baseDeps,
    );
    await server.waitFor(1);
    expect(outcome.packetBytes).toBe(106);
    expect(server.received[0]?.length).toBe(106);
  });

  it('fails cleanly for an invalid MAC', async () => {
    const outcome = await wakeDevice({ mac: 'nope', target: '127.0.0.1', port: 9, wakeMode: 'remote' }, { repeat: 1, delayMs: 0 }, baseDeps);
    expect(outcome.result).toBe('failed');
    expect(outcome.detail).toMatch(/hexadecimal/i);
    expect(outcome.attempts).toEqual([]);
  });

  it('fails cleanly for an unresolvable host', async () => {
    const outcome = await wakeDevice(
      { mac: MAC, target: 'gone.example.test', port: 9, wakeMode: 'remote' },
      { repeat: 1, delayMs: 0 },
      { interfaces: [], lookup: async () => { throw new Error('ENOTFOUND'); } },
    );
    expect(outcome.result).toBe('failed');
    expect(outcome.detail).toMatch(/Could not resolve "gone\.example\.test"/);
  });

  it("returns 'partial' when only some destinations work", async () => {
    const server = await listen();
    const outcome = await wakeDevice(
      { mac: MAC, target: 'x', port: server.port, wakeMode: 'local', broadcast: '127.0.0.1' },
      { repeat: 1, delayMs: 0 },
      // unrelated interface: the explicit broadcast is not on it, so both attempts are unbound
      { interfaces: [{ name: 'eth0', address: '10.1.1.2', netmask: '255.255.255.0', broadcast: '10.1.1.255' }], lookup: async () => [] },
    );
    // 127.0.0.1 is reachable; 255.255.255.255 may or may not be depending on the machine's network.
    expect(['sent', 'partial']).toContain(outcome.result);
    expect(outcome.destinations).toContain(`127.0.0.1:${server.port}`);
  });
});
