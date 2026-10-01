import { asc, eq, inArray, max } from 'drizzle-orm';
import {
  DEVICE_COLORS,
  DEVICE_ICONS,
  LIMITS,
  type DeviceColor,
  type DeviceCreateInput,
  type DeviceIcon,
  type DevicePatchInput,
} from '@/lib/schemas';
import type { DeviceDto } from '@/lib/types';
import { getDb, type Db } from '../db';
import { devices, type DeviceRow, type NewDeviceRow } from '../db/schema';
import { getSettings } from './settings';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function toDto(row: DeviceRow): DeviceDto {
  return {
    id: row.id,
    name: row.name,
    mac: row.mac,
    target: row.target,
    port: row.port,
    wakeMode: row.wakeMode,
    broadcast: row.broadcast,
    secureOn: row.secureOn,
    icon: (DEVICE_ICONS as readonly string[]).includes(row.icon ?? '') ? (row.icon as DeviceIcon) : null,
    color: (DEVICE_COLORS as readonly string[]).includes(row.color ?? '') ? (row.color as DeviceColor) : null,
    groupName: row.groupName,
    statusPort: row.statusPort,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listDeviceRows(): DeviceRow[] {
  return getDb().select().from(devices).orderBy(asc(devices.sortOrder), asc(devices.id)).all();
}

export function listDevices(): DeviceDto[] {
  return listDeviceRows().map(toDto);
}

export function getDeviceRow(id: number): DeviceRow | undefined {
  return getDb().select().from(devices).where(eq(devices.id, id)).get();
}

export function getDevice(id: number): DeviceDto | undefined {
  const row = getDeviceRow(id);
  return row ? toDto(row) : undefined;
}

export function deviceRowsByIds(ids: number[]): DeviceRow[] {
  if (ids.length === 0) return [];
  const rows = getDb().select().from(devices).where(inArray(devices.id, ids)).all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  // keep the caller's order, drop unknown ids
  return ids.map((id) => byId.get(id)).filter((r): r is DeviceRow => r !== undefined);
}

export function deviceRowsInGroup(group: string): DeviceRow[] {
  return listDeviceRows().filter((r) => r.groupName?.toLowerCase() === group.toLowerCase());
}

function rowValues(input: DeviceCreateInput, defaultPort: number): Omit<NewDeviceRow, 'sortOrder'> {
  return {
    name: input.name,
    mac: input.mac,
    target: input.target,
    port: input.port ?? defaultPort,
    wakeMode: input.wakeMode ?? 'local',
    broadcast: input.broadcast ?? null,
    secureOn: input.secureOn ?? null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    groupName: input.groupName ?? null,
    statusPort: input.statusPort ?? null,
  };
}

function nextSortOrder(tx: Tx | Db): number {
  const row = tx.select({ m: max(devices.sortOrder) }).from(devices).get();
  return (row?.m ?? -1) + 1;
}

export function createDevice(input: DeviceCreateInput): DeviceDto {
  const defaultPort = getSettings().defaultPort;
  const row = getDb().transaction((tx) =>
    tx
      .insert(devices)
      .values({ ...rowValues(input, defaultPort), sortOrder: nextSortOrder(tx) })
      .returning()
      .get(),
  );
  return toDto(row);
}

export function updateDevice(id: number, patch: DevicePatchInput): DeviceDto | undefined {
  const set: Partial<NewDeviceRow> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.mac !== undefined) set.mac = patch.mac;
  if (patch.target !== undefined) set.target = patch.target;
  if (patch.port !== undefined) set.port = patch.port;
  if (patch.wakeMode !== undefined) set.wakeMode = patch.wakeMode;
  if (patch.broadcast !== undefined) set.broadcast = patch.broadcast;
  if (patch.secureOn !== undefined) set.secureOn = patch.secureOn;
  if (patch.icon !== undefined) set.icon = patch.icon;
  if (patch.color !== undefined) set.color = patch.color;
  if (patch.groupName !== undefined) set.groupName = patch.groupName;
  if (patch.statusPort !== undefined) set.statusPort = patch.statusPort;
  set.updatedAt = Date.now();

  const row = getDb().update(devices).set(set).where(eq(devices.id, id)).returning().get();
  return row ? toDto(row) : undefined;
}

export function deleteDevice(id: number): boolean {
  return getDb().delete(devices).where(eq(devices.id, id)).returning({ id: devices.id }).all().length > 0;
}

function renumber(tx: Tx, ids: number[]): void {
  ids.forEach((id, index) => {
    tx.update(devices).set({ sortOrder: index }).where(eq(devices.id, id)).run();
  });
}

/** Copies a device and places the copy right after the original. */
export function duplicateDevice(id: number): DeviceDto | undefined {
  return getDb().transaction((tx) => {
    const original = tx.select().from(devices).where(eq(devices.id, id)).get();
    if (!original) return undefined;

    const suffix = ' (copy)';
    const name = `${original.name.slice(0, LIMITS.nameMax - suffix.length)}${suffix}`;
    const { id: _id, createdAt: _c, updatedAt: _u, sortOrder: _s, ...rest } = original;
    const now = Date.now();
    const copy = tx
      .insert(devices)
      .values({ ...rest, name, sortOrder: nextSortOrder(tx), createdAt: now, updatedAt: now })
      .returning()
      .get();

    const ordered = tx
      .select({ id: devices.id })
      .from(devices)
      .orderBy(asc(devices.sortOrder), asc(devices.id))
      .all()
      .map((r) => r.id)
      .filter((existing) => existing !== copy.id);
    ordered.splice(ordered.indexOf(original.id) + 1, 0, copy.id);
    renumber(tx, ordered);

    return toDto({ ...copy, sortOrder: ordered.indexOf(copy.id) });
  });
}

/**
 * Persists a new order. `ids` lists devices in their new order; devices not mentioned keep their
 * relative order after the listed ones. Returns false when an id does not exist.
 */
export function reorderDevices(ids: number[]): boolean {
  return getDb().transaction((tx) => {
    const current = tx
      .select({ id: devices.id })
      .from(devices)
      .orderBy(asc(devices.sortOrder), asc(devices.id))
      .all()
      .map((r) => r.id);
    const known = new Set(current);
    if (ids.some((id) => !known.has(id))) return false;
    const listed = new Set(ids);
    renumber(tx, [...ids, ...current.filter((id) => !listed.has(id))]);
    return true;
  });
}

export const EXPORT_FORMAT = 'connectwol-devices';
export const EXPORT_VERSION = 1;

export interface DeviceExport {
  app: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  devices: Array<Omit<DeviceDto, 'id' | 'sortOrder' | 'createdAt' | 'updatedAt'>>;
}

export function exportDevices(): DeviceExport {
  return {
    app: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    devices: listDevices().map(({ id: _id, sortOrder: _s, createdAt: _c, updatedAt: _u, ...rest }) => rest),
  };
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  replaced: boolean;
}

/**
 * Imports already-validated devices. In `append` mode an entry identical to an existing one (same
 * name, MAC, target and port) is skipped so re-importing a backup does not create duplicates.
 */
export function importDevices(items: DeviceCreateInput[], mode: 'append' | 'replace'): ImportSummary {
  const defaultPort = getSettings().defaultPort;
  return getDb().transaction((tx) => {
    if (mode === 'replace') tx.delete(devices).run();

    const fingerprint = (r: { name: string; mac: string; target: string; port: number }) =>
      `${r.name}|${r.mac}|${r.target.toLowerCase()}|${r.port}`;
    const seen = new Set(tx.select().from(devices).all().map(fingerprint));

    let order = nextSortOrder(tx);
    let imported = 0;
    let skipped = 0;
    for (const item of items) {
      const values = rowValues(item, defaultPort);
      const key = fingerprint({ name: values.name, mac: values.mac, target: values.target, port: values.port ?? defaultPort });
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      tx.insert(devices).values({ ...values, sortOrder: order++ }).run();
      imported += 1;
    }
    return { imported, skipped, replaced: mode === 'replace' };
  });
}
