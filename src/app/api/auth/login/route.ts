import { loginSchema } from '@/lib/schemas';
import { getLimiter } from '@/server/auth/rate-limit';
import { sessionCookieHeader } from '@/server/auth/session-cookie';
import { createSession } from '@/server/auth/sessions';
import { setupRequired, verifyLogin } from '@/server/auth/users';
import { ApiError, conflict, defineRoute, jsonWithCookies } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FAILURE_WINDOW_MS = 15 * 60_000;
const MAX_FAILURES_PER_ACCOUNT = 8;

export const POST = defineRoute(
  // Per-client throttle on every attempt, successful or not.
  { auth: false, limit: { name: 'login-ip', limit: 15, windowMs: 10 * 60_000 } },
  async ({ req, json }) => {
    const { username, password } = await json(loginSchema);
    if (setupRequired()) throw conflict('No administrator exists yet. Complete the first-run setup.');

    // Per-account throttle on failures: slows distributed guessing against the single admin account.
    const failures = getLimiter('login-fail', MAX_FAILURES_PER_ACCOUNT, FAILURE_WINDOW_MS);
    const key = username.toLowerCase();
    const state = failures.peek(key);
    if (!state.allowed) {
      throw new ApiError(
        429,
        'rate_limited',
        `Too many failed sign-in attempts. Try again in ${Math.ceil(state.retryAfterSec / 60)} minute(s).`,
        undefined,
        { 'Retry-After': String(state.retryAfterSec) },
      );
    }

    const user = await verifyLogin(username, password);
    if (!user) {
      failures.record(key);
      throw new ApiError(401, 'invalid_credentials', 'Incorrect username or password.');
    }

    failures.reset(key);
    const { token, csrfToken } = createSession(user.id, req.headers.get('user-agent'));
    return jsonWithCookies({ username: user.username, csrfToken }, [sessionCookieHeader(req, token)]);
  },
);
