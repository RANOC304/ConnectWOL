import { timingSafeEqual } from 'node:crypto';
import { getConfig } from '../config';

/**
 * Best available client identity for rate limiting.
 *
 * Next.js route handlers do not expose the socket address, so without a reverse proxy every client
 * shares the key "direct" (fine for a single-admin home server: the limit is simply global). With
 * TRUST_PROXY=true the right-most X-Forwarded-For entry is used - the one appended by *your* proxy,
 * which a client cannot forge.
 */
export function clientIp(req: Request): string {
  if (!getConfig().trustProxy) return 'direct';
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim();
    if (last) return last.slice(0, 64);
  }
  return req.headers.get('x-real-ip')?.trim().slice(0, 64) || 'direct';
}

export function isSecureRequest(req: Request): boolean {
  const { cookieSecure, trustProxy } = getConfig();
  if (cookieSecure !== 'auto') return cookieSecure;
  if (trustProxy) {
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
    if (proto) return proto === 'https';
  }
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export type OriginCheck = { ok: true } | { ok: false; message: string };

/**
 * Same-origin enforcement for state-changing requests.
 *
 * Modern browsers always send `Sec-Fetch-Site`, which cannot be forged by page scripts, so it is
 * the primary signal. For older clients the `Origin` header is compared with the host. Requests
 * with neither header (curl, scripts) are allowed here and still need the CSRF token to act as an
 * authenticated user.
 */
export function checkSameOrigin(req: Request): OriginCheck {
  const { allowedOrigins, trustProxy } = getConfig();
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');

  if (origin && allowedOrigins.includes(origin.replace(/\/+$/, ''))) return { ok: true };

  if (fetchSite) {
    if (fetchSite === 'same-origin' || fetchSite === 'none') return { ok: true };
    return { ok: false, message: 'Cross-site requests are not allowed.' };
  }

  if (origin === null) return { ok: true };
  if (origin === 'null') return { ok: false, message: 'Requests with an opaque origin are not allowed.' };

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return { ok: false, message: 'Malformed Origin header.' };
  }
  const forwardedHost = trustProxy ? req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() : undefined;
  const host = (forwardedHost || req.headers.get('host') || new URL(req.url).host).toLowerCase();
  if (originHost === host) return { ok: true };
  return {
    ok: false,
    message: `Origin ${origin} does not match host ${host}. Behind a reverse proxy set TRUST_PROXY=true or add the origin to ALLOWED_ORIGINS.`,
  };
}

/** Constant-time comparison of the CSRF header against the session's token. */
export function csrfTokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
