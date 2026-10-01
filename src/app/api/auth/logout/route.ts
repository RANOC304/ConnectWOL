import { clearSessionCookieHeader, readSessionToken } from '@/server/auth/session-cookie';
import { destroySession } from '@/server/auth/sessions';
import { defineRoute, jsonWithCookies } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Works with or without a live session (so a stale cookie can always be cleared); CSRF is checked when one exists. */
export const POST = defineRoute({ auth: false, csrf: true }, async ({ req }) => {
  destroySession(readSessionToken(req));
  return jsonWithCookies({ ok: true }, [clearSessionCookieHeader(req)]);
});
