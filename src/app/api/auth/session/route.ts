import type { SessionDto } from '@/lib/types';
import { setupRequired } from '@/server/auth/users';
import { defineRoute } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tells the client whether to show setup, login or the app, and hands out the CSRF token. */
export const GET = defineRoute({ auth: false }, async ({ session }): Promise<SessionDto> => {
  if (session) {
    return { setupRequired: false, authenticated: true, username: session.username, csrfToken: session.csrfToken };
  }
  return { setupRequired: setupRequired(), authenticated: false };
});
