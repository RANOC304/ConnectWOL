import type { DeviceColor, DeviceIcon, WakeModeValue } from './schemas';

/** A saved computer as returned by the API. */
export interface DeviceDto {
  id: number;
  name: string;
  mac: string;
  target: string;
  port: number;
  wakeMode: WakeModeValue;
  broadcast: string | null;
  secureOn: string | null;
  icon: DeviceIcon | null;
  color: DeviceColor | null;
  groupName: string | null;
  statusPort: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export type WakeResultValue = 'sent' | 'partial' | 'failed';

export interface WakeResultDto {
  deviceId: number;
  deviceName: string;
  result: WakeResultValue;
  destinations: string[];
  repeat: number;
  packetBytes: number;
  detail: string;
  notes: string[];
}

export interface WakeLogDto {
  id: number;
  deviceId: number | null;
  deviceName: string;
  mac: string;
  mode: WakeModeValue;
  destinations: string[];
  repeat: number;
  result: WakeResultValue;
  detail: string | null;
  createdAt: number;
}

export interface PresenceDto {
  deviceId: number;
  state: 'online' | 'offline' | 'unknown';
  detail: string;
  latencyMs?: number;
  /** Why it counts as online: the port accepted a connection, or the host answered but the port is closed. */
  via?: 'connected' | 'refused';
  checkedAt: number;
}

export interface SettingsDto {
  defaultPort: number;
  repeatCount: number;
}

export interface SessionDto {
  setupRequired: boolean;
  authenticated: boolean;
  username?: string;
  csrfToken?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
