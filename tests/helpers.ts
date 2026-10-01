import dgram from 'node:dgram';
import type { AddressInfo } from 'node:net';
import net from 'node:net';
import { POST as setupPost } from '@/app/api/auth/setup/route';
import { resetAllLimiters } from '@/server/auth/rate-limit';
import { closeDb } from '@/server/db';

export const BASE_URL = 'http://localhost:3000';
export const ADMIN = { username: 'admin', password: 'correct horse battery' };

type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;

/** A tiny cookie jar + CSRF token holder, like one browser tab. */
export interface Client {
  cookie?: string;
  csrf?: string;
}

export interface CallOptions {
  method?: string;
  path?: string;
  body?: unknown;
  rawBody?: string;
  params?: Record<string, string>;
  client?: Client;
  headers?: Record<string, string>;
  /** Send the client's CSRF token (default true when the client has one). */
  csrf?: boolean | string;
  contentType?: string | null;
}

export interface CallResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
  setCookies: string[];
}

export async function call<T = any>(handler: unknown, options: CallOptions = {}): Promise<CallResult<T>> {
  const method = options.method ?? 'GET';
  const headers = new Headers(options.headers);
  const client = options.client;
  if (client?.cookie) headers.set('cookie', client.cookie);
  if (client?.csrf && options.csrf !== false && method !== 'GET') {
    headers.set('x-csrf-token', typeof options.csrf === 'string' ? options.csrf : client.csrf);
  } else if (typeof options.csrf === 'string') {
    headers.set('x-csrf-token', options.csrf);
  }

  let body: string | undefined;
  if (options.rawBody !== undefined) body = options.rawBody;
  else if (options.body !== undefined) body = JSON.stringify(options.body);
  else if (method !== 'GET' && method !== 'HEAD') body = '{}';
  if (body !== undefined && options.contentType !== null) {
    headers.set('content-type', options.contentType ?? 'application/json');
  }

  const request = new Request(`${BASE_URL}${options.path ?? '/api/test'}`, { method, headers, body });
  const response = await (handler as Handler)(request, { params: Promise.resolve(options.params ?? {}) as Promise<never> });

  const setCookies = response.headers.getSetCookie();
  if (client) {
    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      if (!pair?.startsWith('cwol_session=')) continue;
      client.cookie = /Max-Age=0/i.test(cookie) ? undefined : pair;
    }
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (client && parsed && typeof parsed === 'object' && 'csrfToken' in parsed && typeof parsed.csrfToken === 'string') {
    client.csrf = parsed.csrfToken;
  }
  return { status: response.status, body: parsed as T, headers: response.headers, setCookies };
}

/** Fresh database and rate-limit counters. Call in `beforeEach`. */
export function resetApp(): void {
  closeDb();
  resetAllLimiters();
  delete process.env.SETUP_TOKEN;
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.COOKIE_SECURE;
  process.env.TRUST_PROXY = 'false';
}

/** Creates the admin account and returns a signed-in client. */
export async function signedInClient(): Promise<Client> {
  const client: Client = {};
  const res = await call(setupPost, { method: 'POST', path: '/api/auth/setup', body: ADMIN, client });
  if (res.status !== 201) throw new Error(`setup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return client;
}

/** A UDP listener on loopback that records every datagram it receives. */
export async function udpListener() {
  const socket = dgram.createSocket('udp4');
  const received: Buffer[] = [];
  socket.on('message', (msg) => received.push(Buffer.from(msg)));
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  return {
    port: (socket.address() as AddressInfo).port,
    received,
    async waitFor(count: number, timeoutMs = 2000) {
      const deadline = Date.now() + timeoutMs;
      while (received.length < count && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    },
    close: () => new Promise<void>((resolve) => socket.close(() => resolve())),
  };
}

/** A TCP listener on loopback (stands in for an RDP/SSH port on a running computer). */
export async function tcpListener() {
  const server = net.createServer((s) => s.destroy());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
