import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { probeTcp } from '@/server/wol/status';

const servers: net.Server[] = [];

async function listen(): Promise<{ server: net.Server; port: number }> {
  const server = net.createServer((s) => s.destroy());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return { server, port: (server.address() as AddressInfo).port };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});

describe('probeTcp', () => {
  it('reports online when the port accepts a connection', async () => {
    const { port } = await listen();
    const result = await probeTcp('127.0.0.1', port, 1000);
    expect(result.state).toBe('online');
    expect(result.via).toBe('connected');
    expect(result.detail).toMatch(/accepted/);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports online (host answered) when the port is closed', async () => {
    const { server, port } = await listen();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    servers.length = 0;
    const result = await probeTcp('127.0.0.1', port, 1000);
    expect(result.state).toBe('online');
    expect(result.via).toBe('refused');
    expect(result.detail).toMatch(/nothing is listening/);
  });

  it('never reports online for an address that cannot answer', async () => {
    // TEST-NET-1 (RFC 5737) is reserved and never routed.
    const result = await probeTcp('192.0.2.1', 80, 400);
    expect(result.state).not.toBe('online');
  });

  it('reports unknown for a name that does not resolve', async () => {
    const result = await probeTcp('definitely-not-a-host.invalid', 80, 1500);
    expect(['unknown', 'offline']).toContain(result.state);
  });

  it('does not throw for an out-of-range port', async () => {
    const result = await probeTcp('127.0.0.1', 70000, 300);
    expect(result.state).toBe('unknown');
  });
});
