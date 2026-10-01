import { timingSafeEqual } from 'node:crypto';
import { setupSchema } from '@/lib/schemas';
import { sessionCookieHeader } from '@/server/auth/session-cookie';
import { createSession } from '@/server/auth/sessions';
import { createAdmin, SetupAlreadyCompleteError, setupRequired } from '@/server/auth/users';
import { getConfig } from '@/server/config';
import { conflict, defineRoute, forbidden, jsonWithCookies } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenMatches(provided: string | undefined, expected: string): boolean {
  const a = Buffer.from(provided ?? '');
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** First-run only: creates the administrator account and signs in. */
export const POST = defineRoute(
  { auth: false, limit: { name: 'setup', limit: 10, windowMs: 15 * 60_000 } },
  async ({ req, json }) => {
    const input = await json(setupSchema);
    if (!setupRequired()) throw conflict('Setup is already complete. Please sign in.');

    const { setupToken } = getConfig();
    if (setupToken && !tokenMatches(input.setupToken, setupToken)) {
      throw forbidden('The setup token is missing or incorrect. It is the SETUP_TOKEN value from the server configuration.', 'bad_setup_token');
    }

    let user;
    try {
      user = await createAdmin(input.username, input.password);
    } catch (error) {
      if (error instanceof SetupAlreadyCompleteError) throw conflict('Setup is already complete. Please sign in.');
      throw error;
    }

    const { token, csrfToken } = createSession(user.id, req.headers.get('user-agent'));
    return jsonWithCookies({ username: user.username, csrfToken }, [sessionCookieHeader(req, token)], { status: 201 });
  },
);
