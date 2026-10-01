import { describe, expect, it } from 'vitest';
import { parseCookies, serializeCookie } from '@/server/auth/cookies';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { RateLimiter } from '@/server/auth/rate-limit';
import { csrfTokenMatches } from '@/server/auth/request';
import { hashToken } from '@/server/auth/sessions';

describe('RateLimiter', () => {
  const clock = (start = 1_000_000) => {
    let now = start;
    return { now: () => now, advance: (ms: number) => (now += ms) };
  };

  it('allows up to the limit, then blocks with a retry hint', () => {
    const c = clock();
    const limiter = new RateLimiter(3, 10_000, c.now);
    expect(limiter.take('a')).toMatchObject({ allowed: true, remaining: 2 });
    expect(limiter.take('a')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.take('a')).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = limiter.take('a');
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
    expect(blocked.retryAfterSec).toBe(10);
  });

  it('slides: old hits expire', () => {
    const c = clock();
    const limiter = new RateLimiter(2, 10_000, c.now);
    limiter.take('a');
    c.advance(6_000);
    limiter.take('a');
    expect(limiter.take('a').allowed).toBe(false);
    c.advance(4_001); // first hit is now outside the window
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
  });

  it('tracks keys independently', () => {
    const limiter = new RateLimiter(1, 10_000, clock().now);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('b').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
  });

  it('peek does not consume; record always does; reset forgives', () => {
    const limiter = new RateLimiter(2, 10_000, clock().now);
    for (let i = 0; i < 5; i++) expect(limiter.peek('a').allowed).toBe(true);
    limiter.record('a');
    limiter.record('a');
    limiter.record('a'); // recording past the limit is fine
    expect(limiter.peek('a').allowed).toBe(false);
    limiter.reset('a');
    expect(limiter.peek('a').allowed).toBe(true);
  });

  it('does not leak memory for expired keys', () => {
    const c = clock();
    const limiter = new RateLimiter(1, 1_000, c.now);
    for (let i = 0; i < 6000; i++) limiter.take(`k${i}`);
    c.advance(2_000);
    limiter.take('fresh'); // triggers a sweep because the map is large
    expect((limiter as unknown as { hits: Map<string, number[]> }).hits.size).toBeLessThan(6000);
  });
});

describe('cookies', () => {
  it('parses a Cookie header', () => {
    expect(parseCookies('a=1; b=two; c=%20x')).toEqual({ a: '1', b: 'two', c: ' x' });
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('keeps the first of duplicate names and survives garbage', () => {
    expect(parseCookies('a=1; a=2')).toEqual({ a: '1' });
    expect(parseCookies('novalue; =x; ok=1; bad=%E0%A4%A')).toEqual({ ok: '1', bad: '%E0%A4%A' });
    expect(parseCookies('q="quoted"')).toEqual({ q: 'quoted' });
  });

  it('serialises with the requested attributes', () => {
    expect(serializeCookie('s', 'v', { httpOnly: true, secure: true, sameSite: 'Strict', maxAgeSec: 60 })).toBe(
      's=v; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Strict',
    );
    expect(serializeCookie('s', 'a b;c')).toBe('s=a%20b%3Bc; Path=/; SameSite=Lax');
    expect(serializeCookie('s', '', { maxAgeSec: 0 })).toContain('Expires=Thu, 01 Jan 1970');
  });
});

describe('passwords and tokens', () => {
  it('hashes with Argon2id and verifies', async () => {
    const hash = await hashPassword('s3cret passphrase');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(hash, 's3cret passphrase')).toBe(true);
    expect(await verifyPassword(hash, 's3cret passphrase ')).toBe(false);
    expect(await hashPassword('s3cret passphrase')).not.toBe(hash); // salted
  });

  it('treats a corrupt stored hash as a failed login, not a crash', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
    expect(await verifyPassword('', 'x')).toBe(false);
  });

  it('hashes session tokens deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('compares CSRF tokens safely', () => {
    expect(csrfTokenMatches('abc', 'abc')).toBe(true);
    expect(csrfTokenMatches('abc', 'abd')).toBe(false);
    expect(csrfTokenMatches('abc', 'abcd')).toBe(false);
    expect(csrfTokenMatches('', 'abc')).toBe(false);
    expect(csrfTokenMatches(null, 'abc')).toBe(false);
  });
});
