import type { PresenceDto, WakeResultDto } from '@/lib/types';
import type { DeviceRow } from '../db/schema';
import { probeTcp } from '../wol/status';
import { wakeDevice, type WakeDevice, type WakeOutcome } from '../wol/wake';
import { recordWake } from './history';
import { getSettings } from './settings';

/** Pause between repeats of the same packet. */
export const REPEAT_DELAY_MS = 120;

/** Runs `worker` over `items` with at most `limit` in flight, preserving result order. */
export async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index] as T);
    }
  });
  await Promise.all(runners);
  return results;
}

export function toWakeDevice(row: DeviceRow): WakeDevice {
  return {
    mac: row.mac,
    target: row.target,
    port: row.port,
    wakeMode: row.wakeMode,
    broadcast: row.broadcast,
    secureOn: row.secureOn,
  };
}

function toResultDto(row: DeviceRow, outcome: WakeOutcome): WakeResultDto {
  return {
    deviceId: row.id,
    deviceName: row.name,
    result: outcome.result,
    destinations: outcome.destinations,
    repeat: outcome.repeat,
    packetBytes: outcome.packetBytes,
    detail: outcome.detail,
    notes: outcome.notes,
  };
}

/** Wakes the given devices (a few at a time), logging each attempt to the history. */
export async function wakeDevices(rows: DeviceRow[]): Promise<WakeResultDto[]> {
  const { repeatCount } = getSettings();
  return mapPool(rows, 6, async (row) => {
    const outcome = await wakeDevice(toWakeDevice(row), { repeat: repeatCount, delayMs: REPEAT_DELAY_MS });
    recordWake({
      deviceId: row.id,
      deviceName: row.name,
      mac: row.mac,
      mode: row.wakeMode,
      destinations: outcome.destinations,
      repeat: outcome.repeat,
      result: outcome.result,
      detail: outcome.detail,
    });
    return toResultDto(row, outcome);
  });
}

/** Best-effort TCP presence check for every given device that has a status port configured. */
export async function checkPresence(rows: DeviceRow[]): Promise<PresenceDto[]> {
  const probeable = rows.filter((r) => r.statusPort !== null);
  return mapPool(probeable, 16, async (row) => {
    const result = await probeTcp(row.target, row.statusPort as number);
    return { deviceId: row.id, ...result, checkedAt: Date.now() };
  });
}
