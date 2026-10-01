// Every test file gets its own in-memory database unless it overrides this before importing the db module.
process.env.DATABASE_PATH = ':memory:';
process.env.TRUST_PROXY = 'false';
process.env.SESSION_TTL_DAYS = '30';
delete process.env.SETUP_TOKEN;
delete process.env.ALLOWED_ORIGINS;
delete process.env.COOKIE_SECURE;
