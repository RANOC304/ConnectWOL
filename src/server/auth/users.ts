import { count, eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { users, type UserRow } from '../db/schema';
import { hashPassword, verifyDummy, verifyPassword } from './password';

export class SetupAlreadyCompleteError extends Error {
  constructor() {
    super('An administrator account already exists.');
    this.name = 'SetupAlreadyCompleteError';
  }
}

export function userCount(): number {
  return getDb().select({ n: count() }).from(users).get()?.n ?? 0;
}

export function setupRequired(): boolean {
  return userCount() === 0;
}

/**
 * Creates the single administrator. The count check and the insert run in one synchronous
 * transaction, so two simultaneous first-run requests cannot both succeed.
 */
export async function createAdmin(username: string, password: string): Promise<UserRow> {
  const passwordHash = await hashPassword(password);
  const db = getDb();
  return db.transaction((tx) => {
    const existing = tx.select({ n: count() }).from(users).get()?.n ?? 0;
    if (existing > 0) throw new SetupAlreadyCompleteError();
    return tx.insert(users).values({ username, passwordHash }).returning().get();
  });
}

/** Returns the user when the credentials are right, otherwise null (in constant-ish time). */
export async function verifyLogin(username: string, password: string): Promise<UserRow | null> {
  const user = getDb()
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${username.trim().toLowerCase()}`)
    .get();
  if (!user) {
    await verifyDummy(password);
    return null;
  }
  return (await verifyPassword(user.passwordHash, password)) ? user : null;
}

/** Returns false when `current` is wrong. */
export async function changePassword(userId: number, current: string, next: string): Promise<boolean> {
  const db = getDb();
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || !(await verifyPassword(user.passwordHash, current))) return false;
  const passwordHash = await hashPassword(next);
  db.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();
  return true;
}
