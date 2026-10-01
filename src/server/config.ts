/**
 * Runtime configuration, read from environment variables on every call so tests (and a restarted
 * process) always see the current values.
 */
export interface AppConfig {
  databasePath: string;
  /** Trust X-Forwarded-* headers. Only enable behind a reverse proxy you control. */
  trustProxy: boolean;
  /** `auto` sets the Secure cookie flag when the request arrived over HTTPS. */
  cookieSecure: 'auto' | boolean;
  /** When set, creating the first admin account requires this token. */
  setupToken: string | null;
  allowedOrigins: string[];
  sessionTtlDays: number;
}

function flag(value: string | undefined): boolean {
  return value !== undefined && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const cookie = env.COOKIE_SECURE?.trim().toLowerCase();
  const ttl = Number(env.SESSION_TTL_DAYS);
  return {
    databasePath: env.DATABASE_PATH?.trim() || './data/connectwol.db',
    trustProxy: flag(env.TRUST_PROXY),
    cookieSecure: cookie === undefined || cookie === '' || cookie === 'auto' ? 'auto' : flag(cookie),
    setupToken: env.SETUP_TOKEN?.trim() || null,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    sessionTtlDays: Number.isFinite(ttl) && ttl >= 1 && ttl <= 365 ? Math.floor(ttl) : 30,
  };
}
