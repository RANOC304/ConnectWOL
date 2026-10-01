import { createHash, randomBytes } from 'node:crypto';
import { and, eq, lt, ne } from 'drizzle-orm';
import { getConfig } from '../config';
import { getDb } from '../db';
import { sessions, users } from '../db/schema';

export const SESSION_COOKIE = 'cwol_session';

/** A session is re-stamped (and its cookie re-issued) when it was last seen longer ago than this. */
const RENEW_AFTER_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SessionInfo {
  id: string;
  userId: number;
  username: string;
  csrfToken: string;
  expiresAt: number;
  /** True when this request extended the session; the caller should re-issue the cookie. */
  renewed: boolean;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const newToken = () => randomBytes(32).toString('base64url');

export function sessionMaxAgeSec(): number {
  return getConfig().sessionTtlDays * (DAY_MS / 1000);
}

/** Creates a session and returns the raw token for the cookie (only its hash is stored). */
export function createSession(userId: number, userAgent?: string | null): { token: string; csrfToken: string } {
  const db = getDb();
  const now = Date.now();
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run(); // opportunistic clean-up

  const token = newToken();
  const csrfToken = newToken();
  db.insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      csrfToken,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + getConfig().sessionTtlDays * DAY_MS,
      userAgent: userAgent ? userAgent.slice(0, 200) : null,
    })
    .run();
  return { token, csrfToken };
}

/**
 * Looks up a session by cookie token; expired sessions are removed. With `renew` (the default,
 * used by route handlers) the expiry slides forward and `renewed` tells the caller to re-issue the
 * cookie. Server components pass `renew: false` because they cannot set cookies.
 */
export function resolveSession(token: string | undefined | null, { renew = true } = {}): SessionInfo | null {
  if (!token || token.length < 20 || token.length > 200) return null;
  const db = getDb();
  const id = hashToken(token);
  const row = db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      csrfToken: sessions.csrfToken,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
      username: users.username,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .get();
  if (!row) return null;

  const now = Date.now();
  if (row.expiresAt <= now) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
    return null;
  }

  let expiresAt = row.expiresAt;
  let renewed = false;
  if (renew && now - row.lastSeenAt > RENEW_AFTER_MS) {
    expiresAt = now + getConfig().sessionTtlDays * DAY_MS;
    db.update(sessions).set({ lastSeenAt: now, expiresAt }).where(eq(sessions.id, id)).run();
    renewed = true;
  }
  return { id, userId: row.userId, username: row.username, csrfToken: row.csrfToken, expiresAt, renewed };
}

export function destroySession(token: string | undefined | null): void {
  if (!token) return;
  getDb().delete(sessions).where(eq(sessions.id, hashToken(token))).run();
}

/** Ends every session of a user except `keepId` (used after a password change). */
export function destroyOtherSessions(userId: number, keepId: string): void {
  getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, keepId)))
    .run();
}
