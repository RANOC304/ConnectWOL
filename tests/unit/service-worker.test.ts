import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Loads public/sw.js in a sandbox with a fake Cache Storage and fetch, then drives its event
 * handlers. This checks the caching *policy* (what is and is not cached) without a real browser.
 */

type Handler = (event: any) => void;

class FakeCache {
  entries = new Map<string, Response>();
  async addAll(urls: string[]) {
    for (const url of urls) this.entries.set(url, new Response(`precached:${url}`));
  }
  async put(request: Request | string, response: Response) {
    this.entries.set(typeof request === 'string' ? request : new URL(request.url).pathname, response);
  }
  async match(request: Request | string) {
    const key = typeof request === 'string' ? request : new URL(request.url).pathname;
    const hit = this.entries.get(key);
    return hit ? hit.clone() : undefined;
  }
}

function load(network: (req: Request) => Promise<Response>) {
  const handlers = new Map<string, Handler>();
  const stores = new Map<string, FakeCache>();
  const open = (name: string) => {
    if (!stores.has(name)) stores.set(name, new FakeCache());
    return stores.get(name)!;
  };
  const caches = {
    open: async (name: string) => open(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: Request | string) => {
      for (const store of stores.values()) {
        const hit = await store.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const calls: string[] = [];
  const sandbox: Record<string, unknown> = {
    self: {
      addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
      location: { origin: 'https://wol.test' },
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
    },
    caches,
    fetch: async (req: Request) => {
      calls.push(new URL(req.url).pathname);
      return network(req);
    },
    URL,
    Response,
    Request,
    Set,
    Promise,
    location: { origin: 'https://wol.test' },
  };
  vm.runInNewContext(readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8'), sandbox);

  async function dispatch(type: string, request?: Request): Promise<Response | undefined | 'passthrough'> {
    const handler = handlers.get(type);
    if (!handler) throw new Error(`no ${type} handler`);
    let responded: Promise<Response> | undefined;
    let waited: Promise<unknown> | undefined;
    handler({
      request,
      respondWith: (p: Promise<Response>) => (responded = p),
      waitUntil: (p: Promise<unknown>) => (waited = p),
    });
    if (waited) await waited;
    if (type === 'fetch') return responded ? await responded : 'passthrough';
    return undefined;
  }
  return { dispatch, stores, calls, caches };
}

const req = (path: string, { navigate = false, ...init }: RequestInit & { navigate?: boolean } = {}) => {
  const request = new Request(`https://wol.test${path}`, init);
  // Constructed requests cannot have mode "navigate" (only the browser creates those), so fake it.
  if (navigate) Object.defineProperty(request, 'mode', { value: 'navigate' });
  return request;
};

let online = true;
beforeEach(() => {
  online = true;
});
const network = async (request: Request) => {
  if (!online) throw new TypeError('Failed to fetch');
  return new Response(`live:${new URL(request.url).pathname}`);
};

describe('service worker', () => {
  it('precaches the offline page and icons on install', async () => {
    const sw = load(network);
    await sw.dispatch('install');
    const shell = [...sw.stores.entries()].find(([name]) => name.startsWith('cwol-shell-'))![1];
    expect([...shell.entries.keys()]).toEqual(expect.arrayContaining(['/offline.html', '/icons/icon-192.png', '/manifest.webmanifest']));
  });

  it('removes caches from older versions on activate, keeps current ones', async () => {
    const sw = load(network);
    await sw.dispatch('install');
    sw.stores.set('cwol-shell-v0', new FakeCache());
    sw.stores.set('unrelated-cache', new FakeCache());
    await sw.dispatch('activate');
    expect([...sw.stores.keys()]).toContain('unrelated-cache');
    expect([...sw.stores.keys()]).not.toContain('cwol-shell-v0');
  });

  it('never touches API requests (they pass straight through to the network)', async () => {
    const sw = load(network);
    for (const path of ['/api/devices', '/api/auth/session', '/api/devices/1/wake']) {
      expect(await sw.dispatch('fetch', req(path))).toBe('passthrough');
    }
    expect(sw.calls).toEqual([]);
  });

  it('ignores non-GET requests and cross-origin requests', async () => {
    const sw = load(network);
    expect(await sw.dispatch('fetch', req('/anything', { method: 'POST', body: '{}' }))).toBe('passthrough');
    expect(await sw.dispatch('fetch', new Request('https://other.example/_next/static/a.js'))).toBe('passthrough');
  });

  it('does not intercept its own script, so updates always reach installed apps', async () => {
    const sw = load(network);
    expect(await sw.dispatch('fetch', req('/sw.js'))).toBe('passthrough');
  });

  it('serves hashed build assets cache-first', async () => {
    const sw = load(network);
    const first = (await sw.dispatch('fetch', req('/_next/static/chunks/app.abc123.js'))) as Response;
    expect(await first.text()).toBe('live:/_next/static/chunks/app.abc123.js');
    online = false; // from here on only the cache can answer
    const second = (await sw.dispatch('fetch', req('/_next/static/chunks/app.abc123.js'))) as Response;
    expect(await second.text()).toBe('live:/_next/static/chunks/app.abc123.js');
    expect(sw.calls).toHaveLength(1);
  });

  it('does not cache failed asset responses', async () => {
    const sw = load(async () => new Response('nope', { status: 500 }));
    await sw.dispatch('fetch', req('/_next/static/chunks/broken.js'));
    const asset = [...sw.stores.entries()].find(([name]) => name.startsWith('cwol-assets-'));
    expect(asset?.[1].entries.size ?? 0).toBe(0);
  });

  it('page loads always go to the network and are never stored', async () => {
    const sw = load(network);
    const response = (await sw.dispatch('fetch', req('/', { navigate: true }))) as Response;
    expect(await response.text()).toBe('live:/');
    for (const store of sw.stores.values()) expect(store.entries.has('/')).toBe(false);
  });

  it('shows the offline page when a page load fails', async () => {
    const sw = load(network);
    await sw.dispatch('install');
    online = false;
    const response = (await sw.dispatch('fetch', req('/history', { navigate: true }))) as Response;
    expect(await response.text()).toBe('precached:/offline.html');
  });

  it('serves icons stale-while-revalidate', async () => {
    const sw = load(network);
    await sw.dispatch('install');
    const cached = (await sw.dispatch('fetch', req('/icons/icon-192.png'))) as Response;
    expect(await cached.text()).toBe('precached:/icons/icon-192.png');
  });
});
