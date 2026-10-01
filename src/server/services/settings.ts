import { eq } from 'drizzle-orm';
import { LIMITS } from '@/lib/schemas';
import type { SettingsDto } from '@/lib/types';
import { getDb } from '../db';
import { settings } from '../db/schema';

export const DEFAULT_SETTINGS: SettingsDto = { defaultPort: 9, repeatCount: 3 };

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function getSettings(): SettingsDto {
  const rows = getDb().select().from(settings).all();
  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      raw[row.key] = JSON.parse(row.value);
    } catch {
      // ignore corrupt rows; defaults apply
    }
  }
  return {
    defaultPort: clampInt(raw.defaultPort, 1, 65535, DEFAULT_SETTINGS.defaultPort),
    repeatCount: clampInt(raw.repeatCount, LIMITS.repeatMin, LIMITS.repeatMax, DEFAULT_SETTINGS.repeatCount),
  };
}

export function updateSettings(patch: Partial<SettingsDto>): SettingsDto {
  const db = getDb();
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const json = JSON.stringify(value);
      tx.insert(settings)
        .values({ key, value: json })
        .onConflictDoUpdate({ target: settings.key, set: { value: json } })
        .run();
    }
  });
  return getSettings();
}

export function deleteSetting(key: string): void {
  getDb().delete(settings).where(eq(settings.key, key)).run();
}
