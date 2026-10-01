import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Timestamps are stored as epoch milliseconds. */
const now = () => Date.now();

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(now),
});

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 of the cookie token: a database leak does not leak usable sessions. */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    csrfToken: text('csrf_token').notNull(),
    createdAt: integer('created_at').notNull().$defaultFn(now),
    lastSeenAt: integer('last_seen_at').notNull().$defaultFn(now),
    expiresAt: integer('expires_at').notNull(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
);

export const devices = sqliteTable(
  'devices',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    /** Normalised `AA:BB:CC:DD:EE:FF`. */
    mac: text('mac').notNull(),
    /** IP address or hostname. */
    target: text('target').notNull(),
    port: integer('port').notNull().default(9),
    wakeMode: text('wake_mode', { enum: ['local', 'remote'] })
      .notNull()
      .default('local'),
    /** Optional subnet-directed broadcast override (local mode). */
    broadcast: text('broadcast'),
    /** Optional SecureOn password, normalised hex (4 or 6 bytes). Stored as typed by the owner. */
    secureOn: text('secure_on'),
    icon: text('icon'),
    color: text('color'),
    groupName: text('group_name'),
    /** TCP port probed for the best-effort online check. */
    statusPort: integer('status_port'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull().$defaultFn(now),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [index('devices_sort_idx').on(t.sortOrder), index('devices_group_idx').on(t.groupName)],
);

export const wakeLog = sqliteTable(
  'wake_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Deliberately not a foreign key: history outlives deleted devices. */
    deviceId: integer('device_id'),
    deviceName: text('device_name').notNull(),
    mac: text('mac').notNull(),
    mode: text('mode', { enum: ['local', 'remote'] }).notNull(),
    /** JSON array of `host:port` strings. */
    destinations: text('destinations').notNull().default('[]'),
    repeat: integer('repeat').notNull().default(1),
    result: text('result', { enum: ['sent', 'partial', 'failed'] }).notNull(),
    detail: text('detail'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('wake_log_created_idx').on(t.createdAt)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  /** JSON-encoded value. */
  value: text('value').notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type DeviceRow = typeof devices.$inferSelect;
export type NewDeviceRow = typeof devices.$inferInsert;
export type WakeLogRow = typeof wakeLog.$inferSelect;
