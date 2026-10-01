import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, resolveSession, type SessionInfo } from './sessions';
import { setupRequired } from './users';

/**
 * Session lookup for server components. Read-only: it never renews, because server components
 * cannot set cookies (the API route wrapper does the sliding renewal).
 */
export async function currentSession(): Promise<SessionInfo | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return resolveSession(token, { renew: false });
}

/** Redirects to the first-run setup or the login screen when nobody is signed in. */
export async function requireSession(): Promise<SessionInfo> {
  const session = await currentSession();
  if (!session) redirect(setupRequired() ? '/setup' : '/login');
  return session;
}
