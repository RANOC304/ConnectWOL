import { parseCookies, serializeCookie } from './cookies';
import { isSecureRequest } from './request';
import { SESSION_COOKIE, sessionMaxAgeSec } from './sessions';

export function readSessionToken(req: Request): string | undefined {
  return parseCookies(req.headers.get('cookie'))[SESSION_COOKIE];
}

/** `Set-Cookie` value that starts (or refreshes) the browser session. */
export function sessionCookieHeader(req: Request, token: string): string {
  return serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'Lax',
    maxAgeSec: sessionMaxAgeSec(),
  });
}

/** `Set-Cookie` value that deletes the session cookie. */
export function clearSessionCookieHeader(req: Request): string {
  return serializeCookie(SESSION_COOKIE, '', { httpOnly: true, secure: isSecureRequest(req), sameSite: 'Lax', maxAgeSec: 0 });
}
