import { count, desc, lte } from 'drizzle-orm';
import type { WakeLogDto } from '@/lib/types';
import { getDb } from '../db';
import { wakeLog, type WakeLogRow } from '../db/schema';
import type { WakeMode } from '../wol/plan';
import type { WakeResult } from '../wol/wake';

/** Older entries beyond this many are discarded so the log cannot grow without bound. */
export const HISTORY_LIMIT = 2000;

export interface WakeLogEntry {
  deviceId: number | null;
  deviceName: string;
  mac: string;
  mode: WakeMode;
  destinations: string[];
  repeat: number;
  result: WakeResult;
  detail: string;
}

export function recordWake(entry: WakeLogEntry): void {
  const db = getDb();
  db.insert(wakeLog)
    .values({
      deviceId: entry.deviceId,
      deviceName: entry.deviceName,
      mac: entry.mac,
      mode: entry.mode,
      destinations: JSON.stringify(entry.destinations),
      repeat: entry.repeat,
      result: entry.result,
      detail: entry.detail.slice(0, 500),
    })
    .run();

  const cutoff = db.select({ id: wakeLog.id }).from(wakeLog).orderBy(desc(wakeLog.id)).limit(1).offset(HISTORY_LIMIT).get();
  if (cutoff) db.delete(wakeLog).where(lte(wakeLog.id, cutoff.id)).run();
}

function toDto(row: WakeLogRow): WakeLogDto {
  let destinations: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.destinations);
    if (Array.isArray(parsed)) destinations = parsed.filter((d): d is string => typeof d === 'string');
  } catch {
    // keep []
  }
  return {
    id: row.id,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    mac: row.mac,
    mode: row.mode,
    destinations,
    repeat: row.repeat,
    result: row.result,
    detail: row.detail,
    createdAt: row.createdAt,
  };
}

export function listHistory(limit: number, offset: number): { items: WakeLogDto[]; total: number } {
  const db = getDb();
  const rows = db.select().from(wakeLog).orderBy(desc(wakeLog.createdAt), desc(wakeLog.id)).limit(limit).offset(offset).all();
  const total = db.select({ n: count() }).from(wakeLog).get()?.n ?? 0;
  return { items: rows.map(toDto), total };
}

export function clearHistory(): number {
  return getDb().delete(wakeLog).returning({ id: wakeLog.id }).all().length;
}
