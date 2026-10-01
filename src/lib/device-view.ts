import { DEVICE_COLORS, type DeviceColor } from './schemas';
import type { DeviceDto } from './types';

/** Case-insensitive match on name, group, address and MAC (with or without separators). */
export function filterDevices(devices: DeviceDto[], query: string, group: string | null): DeviceDto[] {
  const q = query.trim().toLowerCase();
  const qMac = q.replace(/[^0-9a-f]/g, '');
  return devices.filter((d) => {
    if (group !== null && (d.groupName ?? '').toLowerCase() !== group.toLowerCase()) return false;
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.target.toLowerCase().includes(q) ||
      (d.groupName ?? '').toLowerCase().includes(q) ||
      d.mac.toLowerCase().includes(q) ||
      (qMac.length >= 2 && d.mac.replace(/:/g, '').toLowerCase().includes(qMac))
    );
  });
}

export interface GroupInfo {
  name: string;
  count: number;
}

/** Distinct groups (case-insensitive) with device counts, alphabetically. */
export function groupsOf(devices: DeviceDto[]): GroupInfo[] {
  const map = new Map<string, GroupInfo>();
  for (const d of devices) {
    if (!d.groupName) continue;
    const key = d.groupName.toLowerCase();
    const entry = map.get(key);
    if (entry) entry.count += 1;
    else map.set(key, { name: d.groupName, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** New devices cycle through the palette so a fresh list is colourful without any setup. */
export function suggestColor(existingCount: number): DeviceColor {
  return DEVICE_COLORS[existingCount % DEVICE_COLORS.length] as DeviceColor;
}

export function formatTarget(device: Pick<DeviceDto, 'target' | 'port'>): string {
  const host = device.target.includes(':') ? `[${device.target}]` : device.target;
  return `${host}:${device.port}`;
}

/** "just now", "5 min ago", "yesterday"… with the exact time left to a tooltip. */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
