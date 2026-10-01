'use client';

import { formatTarget } from '@/lib/device-view';
import type { DeviceDto, PresenceDto } from '@/lib/types';
import { DeviceGlyph, Icon } from '../Icons';
import { WakeButton, type WakePhase } from './WakeButton';

export interface WakeStatus {
  phase: WakePhase;
  /** Honest one-liner shown under the card. */
  message?: string;
  tone?: 'info' | 'error';
}

interface Props {
  device: DeviceDto;
  index: number;
  wake: WakeStatus | undefined;
  presence: PresenceDto | undefined;
  checking: boolean;
  reorderMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onWake: () => void;
  onOpen: () => void;
  onMove: (direction: -1 | 1) => void;
}

function StatusPill({ device, presence, checking }: { device: DeviceDto; presence: PresenceDto | undefined; checking: boolean }) {
  if (device.statusPort === null) return null;
  if (checking) return <span className="pill pill--busy pill--plain">Checking…</span>;
  if (!presence) return <span className="pill pill--off">Not checked</span>;
  // A reset means the machine is up but that port is closed: say so instead of implying the service works.
  const portClosed = presence.state === 'online' && presence.via === 'refused';
  const label = portClosed ? 'Online · port closed' : presence.state === 'online' ? 'Online' : presence.state === 'offline' ? 'No answer' : 'Unknown';
  const tone = portClosed ? 'pill--warn' : presence.state === 'online' ? 'pill--ok' : presence.state === 'offline' ? 'pill--off' : 'pill--warn';
  return (
    <span className={`pill ${tone}`} title={`${presence.detail} (best-effort check of port ${device.statusPort})`}>
      {label}
    </span>
  );
}

export function DeviceCard({ device, index, wake, presence, checking, reorderMode, isFirst, isLast, onWake, onOpen, onMove }: Props) {
  const phase = wake?.phase ?? 'idle';
  return (
    <li className="device" data-color={device.color ?? undefined} data-wake={phase} style={{ ['--i' as string]: index }}>
      <button type="button" className="device__main" onClick={onOpen} aria-label={`${device.name}: open options`}>
        <span className="device__tile">
          <DeviceGlyph icon={device.icon} />
        </span>
        <span className="device__text">
          <span className="device__name">{device.name}</span>
          <span className="device__meta">{formatTarget(device)}</span>
          <span className="device__tags">
            {device.groupName && <span className="pill pill--plain">{device.groupName}</span>}
            {device.wakeMode === 'remote' && <span className="pill pill--plain">Remote</span>}
            <StatusPill device={device} presence={presence} checking={checking} />
          </span>
        </span>
      </button>

      {reorderMode ? (
        <div className="device__reorder" role="group" aria-label={`Move ${device.name}`}>
          <button type="button" className="icon-btn" onClick={() => onMove(-1)} disabled={isFirst} aria-label={`Move ${device.name} up`}>
            <Icon name="up" />
          </button>
          <button type="button" className="icon-btn" onClick={() => onMove(1)} disabled={isLast} aria-label={`Move ${device.name} down`}>
            <Icon name="down" />
          </button>
        </div>
      ) : (
        <WakeButton name={device.name} phase={phase} onWake={onWake} />
      )}

      <div role="status" aria-live="polite" style={{ gridColumn: '1 / -1' }}>
        {wake?.message && <p className={`device__msg${wake.tone === 'error' ? ' device__msg--error' : ''}`}>{wake.message}</p>}
      </div>
    </li>
  );
}
