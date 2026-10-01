import { describe, expect, it } from 'vitest';
import type { NetworkInterfaceInfo } from 'node:os';
import {
  directedBroadcast,
  inSubnet,
  intToIpv4,
  ipv4ToInt,
  isValidIpv4,
  listIpv4Interfaces,
  type Ipv4Interface,
} from '@/server/wol/network';
import { planWake, WakePlanError, type PlanDeps } from '@/server/wol/plan';

const lan: Ipv4Interface = { name: 'eth0', address: '192.168.1.20', netmask: '255.255.255.0', broadcast: '192.168.1.255' };
const iot: Ipv4Interface = { name: 'eth1', address: '10.0.4.7', netmask: '255.255.252.0', broadcast: '10.0.7.255' };

const deps = (interfaces: Ipv4Interface[], table: Record<string, string[]> = {}): PlanDeps => ({
  interfaces,
  lookup: async (host) => {
    const hit = table[host];
    if (!hit) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    return hit;
  },
});

describe('IPv4 helpers', () => {
  it('converts to and from integers', () => {
    expect(ipv4ToInt('0.0.0.0')).toBe(0);
    expect(ipv4ToInt('255.255.255.255')).toBe(0xffffffff);
    expect(intToIpv4(ipv4ToInt('192.168.10.200'))).toBe('192.168.10.200');
  });

  it('rejects malformed addresses', () => {
    for (const bad of ['', '1.2.3', '1.2.3.4.5', '256.1.1.1', 'a.b.c.d', '1.2.3.-4', '01.2.3.4 ']) {
      expect(isValidIpv4(bad)).toBe(false);
    }
    expect(isValidIpv4('192.168.1.1')).toBe(true);
  });

  it('computes directed broadcast addresses', () => {
    expect(directedBroadcast('192.168.1.20', '255.255.255.0')).toBe('192.168.1.255');
    expect(directedBroadcast('10.0.4.7', '255.255.252.0')).toBe('10.0.7.255');
    expect(directedBroadcast('172.16.5.9', '255.255.0.0')).toBe('172.16.255.255');
    expect(directedBroadcast('192.168.1.130', '255.255.255.128')).toBe('192.168.1.255');
    expect(directedBroadcast('192.168.1.5', '255.255.255.192')).toBe('192.168.1.63');
  });

  it('checks subnet membership', () => {
    expect(inSubnet('192.168.1.99', lan)).toBe(true);
    expect(inSubnet('192.168.2.99', lan)).toBe(false);
    expect(inSubnet('10.0.6.1', iot)).toBe(true);
    expect(inSubnet('10.0.8.1', iot)).toBe(false);
  });
});

describe('listIpv4Interfaces', () => {
  const info = (over: Partial<NetworkInterfaceInfo>): NetworkInterfaceInfo =>
    ({
      address: '192.168.1.20',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: null,
      ...over,
    }) as NetworkInterfaceInfo;

  it('keeps real IPv4 interfaces and drops loopback, IPv6 and point-to-point links', () => {
    const result = listIpv4Interfaces({
      lo: [info({ address: '127.0.0.1', netmask: '255.0.0.0', internal: true })],
      eth0: [info({}), info({ address: 'fe80::1', family: 'IPv6', netmask: 'ffff:ffff:ffff:ffff::' } as Partial<NetworkInterfaceInfo>)],
      tailscale0: [info({ address: '100.64.0.5', netmask: '255.255.255.255' })],
      wg0: [info({ address: '10.9.0.2', netmask: '255.255.255.254' })],
      down: undefined,
    });
    expect(result).toEqual([{ name: 'eth0', address: '192.168.1.20', netmask: '255.255.255.0', broadcast: '192.168.1.255' }]);
  });
});

describe('planWake – local mode', () => {
  it('uses the subnet of the target and always adds the limited broadcast', async () => {
    const plan = await planWake({ mode: 'local', target: '192.168.1.50', port: 9 }, deps([lan, iot]));
    expect(plan.mode).toBe('local');
    expect(plan.attempts).toEqual([
      { from: '192.168.1.20', to: '192.168.1.255', family: 4 },
      { from: '192.168.1.20', to: '255.255.255.255', family: 4 },
    ]);
  });

  it('picks the right interface on a multi-homed host', async () => {
    const plan = await planWake({ mode: 'local', target: '10.0.5.40', port: 9 }, deps([lan, iot]));
    expect(plan.attempts.map((a) => a.to)).toEqual(['10.0.7.255', '255.255.255.255']);
    expect(plan.attempts.every((a) => a.from === '10.0.4.7')).toBe(true);
  });

  it('resolves hostnames to find the subnet', async () => {
    const plan = await planWake({ mode: 'local', target: 'nas.lan', port: 9 }, deps([lan], { 'nas.lan': ['192.168.1.77'] }));
    expect(plan.attempts[0]).toEqual({ from: '192.168.1.20', to: '192.168.1.255', family: 4 });
  });

  it('falls back to every interface when the target cannot be placed', async () => {
    const plan = await planWake({ mode: 'local', target: 'unknown.lan', port: 9 }, deps([lan, iot]));
    expect(plan.attempts.map((a) => a.to)).toEqual(['192.168.1.255', '255.255.255.255', '10.0.7.255', '255.255.255.255']);
    expect(plan.attempts.map((a) => a.from)).toEqual(['192.168.1.20', '192.168.1.20', '10.0.4.7', '10.0.4.7']);
    expect(plan.notes.length).toBeGreaterThan(0);
  });

  it('falls back to every interface for an off-subnet or IPv6 target', async () => {
    const offSubnet = await planWake({ mode: 'local', target: '172.20.0.9', port: 9 }, deps([lan]));
    expect(offSubnet.attempts.map((a) => a.to)).toEqual(['192.168.1.255', '255.255.255.255']);
    const v6 = await planWake({ mode: 'local', target: 'fe80::1', port: 9 }, deps([lan]));
    expect(v6.attempts.map((a) => a.to)).toEqual(['192.168.1.255', '255.255.255.255']);
  });

  it('honours an explicit broadcast address', async () => {
    const plan = await planWake({ mode: 'local', target: '192.168.1.50', port: 7, broadcast: '192.168.1.255' }, deps([lan]));
    expect(plan.port).toBe(7);
    expect(plan.attempts).toEqual([
      { from: '192.168.1.20', to: '192.168.1.255', family: 4 },
      { from: '192.168.1.20', to: '255.255.255.255', family: 4 },
    ]);
  });

  it('sends an explicit broadcast on an unknown network without binding', async () => {
    const plan = await planWake({ mode: 'local', target: 'x', port: 9, broadcast: '172.30.0.255' }, deps([lan]));
    expect(plan.attempts).toEqual([
      { to: '172.30.0.255', family: 4 },
      { to: '255.255.255.255', family: 4 },
    ]);
    expect(plan.notes[0]).toMatch(/not on any/);
  });

  it('rejects a malformed explicit broadcast address', async () => {
    await expect(planWake({ mode: 'local', target: 'x', port: 9, broadcast: '192.168.1' }, deps([lan]))).rejects.toThrow(WakePlanError);
  });

  it('still works with no interfaces at all', async () => {
    const plan = await planWake({ mode: 'local', target: '192.168.1.50', port: 9 }, deps([]));
    expect(plan.attempts).toEqual([{ to: '255.255.255.255', family: 4 }]);
  });

  it('never duplicates a destination', async () => {
    const twin: Ipv4Interface = { ...lan, name: 'eth0:1', address: '192.168.1.21' };
    const plan = await planWake({ mode: 'local', target: 'nope', port: 9 }, deps([lan, twin]));
    const keys = plan.attempts.map((a) => `${a.from}|${a.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('planWake – remote mode', () => {
  it('sends one unicast datagram to an IP literal', async () => {
    const plan = await planWake({ mode: 'remote', target: '203.0.113.9', port: 9 }, deps([lan]));
    expect(plan).toMatchObject({ mode: 'remote', attempts: [{ to: '203.0.113.9', family: 4 }] });
    expect(plan.attempts[0]?.from).toBeUndefined();
  });

  it('resolves a DDNS name, preferring IPv4', async () => {
    const plan = await planWake(
      { mode: 'remote', target: 'home.example.org', port: 9 },
      {
        interfaces: [],
        lookup: async (_host, family) => (family === 6 ? ['2001:db8::1'] : ['198.51.100.7']),
      },
    );
    expect(plan.attempts).toEqual([{ to: '198.51.100.7', family: 4 }]);
    expect(plan.notes[0]).toMatch(/Resolved home\.example\.org/);
  });

  it('falls back to IPv6 when there is no A record', async () => {
    const plan = await planWake(
      { mode: 'remote', target: 'v6only.example.org', port: 9 },
      {
        interfaces: [],
        lookup: async (_host, family) => {
          if (family === 4) throw new Error('no A');
          return ['2001:db8::2'];
        },
      },
    );
    expect(plan.attempts).toEqual([{ to: '2001:db8::2', family: 6 }]);
  });

  it('accepts an IPv6 literal', async () => {
    const plan = await planWake({ mode: 'remote', target: '2001:db8::3', port: 9 }, deps([]));
    expect(plan.attempts).toEqual([{ to: '2001:db8::3', family: 6 }]);
  });

  it('fails with a helpful error when the name does not resolve', async () => {
    await expect(planWake({ mode: 'remote', target: 'missing.example.org', port: 9 }, deps([]))).rejects.toThrow(
      /Could not resolve "missing\.example\.org"/,
    );
  });
});
