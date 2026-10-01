import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getConfig } from '../config';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

// Kept on globalThis so Next.js dev-mode module reloads do not open a second connection.
const globalForDb = globalThis as typeof globalThis & { __connectwolDb?: Db };

/**
 * Where the generated SQL migrations live. `drizzle/` sits next to server.js in the standalone
 * build and in the project root during development and tests.
 */
function migrationsFolder(): string {
  return process.env.MIGRATIONS_DIR?.trim() || join(process.cwd(), 'drizzle');
}

/** Opens the database on first use, applies pending migrations, and returns the shared handle. */
export function getDb(): Db {
  if (globalForDb.__connectwolDb) return globalForDb.__connectwolDb;

  const path = getConfig().databasePath;
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });

  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationsFolder() });

  globalForDb.__connectwolDb = db;
  return db;
}

/** Closes the connection and forgets it (used by tests and graceful shutdown). */
export function closeDb(): void {
  const db = globalForDb.__connectwolDb;
  if (!db) return;
  db.$client.close();
  delete globalForDb.__connectwolDb;
}

export { schema };
