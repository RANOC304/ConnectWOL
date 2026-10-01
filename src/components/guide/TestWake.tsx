'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { formatTarget } from '@/lib/device-view';
import type { DeviceDto, PresenceDto, WakeResultDto } from '@/lib/types';
import { useApp } from '../AppProvider';
import { DeviceGlyph, Icon } from '../Icons';

const WATCH_SECONDS = 90;

/** Step 6: send a real magic packet to one of your saved computers and watch for an answer. */
export function TestWake() {
  const { api, toast } = useApp();
  const [devices, setDevices] = useState<DeviceDto[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<WakeResultDto | null>(null);
  const [presence, setPresence] = useState<PresenceDto | null>(null);
  const [watching, setWatching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ devices: DeviceDto[] }>('/api/devices')
      .then(({ devices: list }) => {
        if (cancelled) return;
        setDevices(list);
        setSelected((current) => current ?? list[0]?.id ?? null);
      })
      .catch((error) => toast(errorMessage(error), 'error'));
    return () => {
      cancelled = true;
    };
  }, [api, toast]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    },
    [],
  );

  const device = devices?.find((d) => d.id === selected) ?? null;

  async function send() {
    if (!device) return;
    setSending(true);
    setResult(null);
    setPresence(null);
    if (timer.current !== null) window.clearInterval(timer.current);
    setWatching(false);
    try {
      const { result: outcome } = await api<{ result: WakeResultDto }>(`/api/devices/${device.id}/wake`, { method: 'POST' });
      setResult(outcome);
      if (outcome.result !== 'failed' && device.statusPort !== null) {
        setWatching(true);
        setElapsed(0);
        const startedAt = Date.now();
        const poll = async () => {
          const seconds = Math.round((Date.now() - startedAt) / 1000);
          setElapsed(seconds);
          try {
            const { statuses } = await api<{ statuses: PresenceDto[] }>('/api/devices/status', { method: 'POST', body: { ids: [device.id] } });
            const status = statuses[0];
            if (status) setPresence(status);
            if (status?.state === 'online' || seconds >= WATCH_SECONDS) {
              if (timer.current !== null) window.clearInterval(timer.current);
              setWatching(false);
            }
          } catch {
            // keep trying until the time runs out
          }
        };
        void poll();
        timer.current = window.setInterval(() => void poll(), 4000);
      }
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setSending(false);
    }
  }

  if (devices === null) {
    return (
      <div className="test-wake" aria-busy="true">
        <span className="spinner" aria-hidden="true" /> Loading your computers…
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="test-wake">
        <p>
          <strong>You haven’t added a computer yet.</strong> Add the one you set up in the previous steps, then come back to test it.
        </p>
        <div>
          <Link className="btn" href="/?add=1">
            <Icon name="plus" />
            Add a computer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="test-wake">
      <div className="test-wake__row">
        <div className="field">
          <label className="field__label" htmlFor="test-device">
            Computer to wake
          </label>
          <select id="test-device" className="select" value={selected ?? ''} onChange={(e) => setSelected(Number(e.target.value))} disabled={sending || watching}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn--accent" onClick={() => void send()} disabled={sending || watching || !device}>
          {sending ? <span className="spinner" aria-hidden="true" /> : <Icon name="power" />}
          {sending ? 'Sending…' : 'Send test wake'}
        </button>
      </div>

      {device && (
        <p className="field__hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-grid', width: 22, height: 22 }}>
            <DeviceGlyph icon={device.icon} />
          </span>
          <span className="mono">
            {device.mac} → {formatTarget(device)} · {device.wakeMode === 'remote' ? 'another network' : 'same network'}
          </span>
        </p>
      )}

      <div role="status" aria-live="polite" style={{ display: 'grid', gap: 10 }}>
        {result && result.result !== 'failed' && (
          <div className="alert alert--ok">
            <Icon name="check" />
            <span>
              {result.detail} That only means the packets left this server. Now look at the computer: it should power on or resume within about 30 seconds.
            </span>
          </div>
        )}
        {result?.result === 'failed' && (
          <div className="alert alert--error">
            <Icon name="alert" />
            <span>Could not send the packet: {result.detail}</span>
          </div>
        )}
        {watching && (
          <div className="alert">
            <span className="spinner" aria-hidden="true" />
            <span>
              Watching port {device?.statusPort} for an answer… {elapsed}s of {WATCH_SECONDS}s
            </span>
          </div>
        )}
        {presence?.state === 'online' && (
          <div className="alert alert--ok">
            <Icon name="check" />
            <span>
              {presence.via === 'refused'
                ? `The computer answered, so it is up (port ${device?.statusPort} is closed, which is fine for this test). `
                : `The computer is answering on port ${device?.statusPort}. `}
              Wake-on-LAN works for this setup. 🎉
            </span>
          </div>
        )}
        {result && result.result !== 'failed' && !watching && presence?.state !== 'online' && device?.statusPort !== null && (
          <div className="alert alert--warn">
            <Icon name="alert" />
            <span>
              Nothing answered on port {device?.statusPort} within {WATCH_SECONDS} seconds. If the computer did not wake, open <Link href="/guide/troubleshooting">Troubleshooting</Link>.
            </span>
          </div>
        )}
        {result && result.result !== 'failed' && device?.statusPort === null && (
          <div className="alert">
            <Icon name="info" />
            <span>
              This computer has no status port, so ConnectWOL cannot watch for it. Check it by eye, or add a status port in its settings (for example 3389 for Remote Desktop).
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
