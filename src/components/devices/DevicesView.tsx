'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { filterDevices, groupsOf } from '@/lib/device-view';
import type { DeviceDto, PresenceDto, SettingsDto, WakeResultDto } from '@/lib/types';
import { useLocalStorage } from '@/lib/use-local-storage';
import { useApp } from '../AppProvider';
import { DeviceGlyph, Icon } from '../Icons';
import { Sheet } from '../Sheet';
import { DeviceCard, type WakeStatus } from './DeviceCard';
import { DeviceForm } from './DeviceForm';
import { EmptyArt } from './EmptyArt';

const WATCH_MS = 90_000;
const RESET_BUTTON_MS = 3600;
const CLEAR_MESSAGE_MS = 25_000;

interface Props {
  initialDevices: DeviceDto[];
  settings: SettingsDto;
  /** Open the "add a computer" sheet straight away (used by the setup guide). */
  openAddOnLoad?: boolean;
}

function describeWake(device: DeviceDto, result: WakeResultDto, wasAnswering: boolean): WakeStatus {
  if (result.result === 'failed') return { phase: 'failed', tone: 'error', message: `Could not send: ${result.detail}` };
  if (result.result === 'partial') {
    return { phase: 'partial', tone: 'info', message: `Sent to some destinations only. ${result.detail}` };
  }
  const sent = `Magic packet sent ×${result.repeat}.`;
  if (wasAnswering) return { phase: 'sent', tone: 'info', message: `${sent} The computer was already answering on port ${device.statusPort}, so it was probably awake.` };
  return {
    phase: 'sent',
    tone: 'info',
    message:
      device.statusPort !== null
        ? `${sent} Waiting for it to answer on port ${device.statusPort}…`
        : `${sent} ConnectWOL can't tell if the computer woke up. Add a status port to see when it does.`,
  };
}

export function DevicesView({ initialDevices, settings, openAddOnLoad = false }: Props) {
  const { api, toast } = useApp();
  const [devices, setDevices] = useState(initialDevices);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [wake, setWake] = useState<Record<number, WakeStatus>>({});
  const [presence, setPresence] = useState<Record<number, PresenceDto>>({});
  const [checking, setChecking] = useState<Record<number, true>>({});
  const [form, setForm] = useState<{ open: boolean; device: DeviceDto | null }>({ open: openAddOnLoad, device: null });
  const [actionsFor, setActionsFor] = useState<DeviceDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DeviceDto | null>(null);
  const [confirmGroup, setConfirmGroup] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useLocalStorage('cwol-guide-banner', null);

  const searchRef = useRef<HTMLInputElement>(null);
  const devicesRef = useRef(devices);
  const watching = useRef(new Map<number, number>());
  const timers = useRef(new Map<number, number[]>());

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // Drop "?add=1" from the address bar once it has been acted on, so a reload does not reopen the sheet.
  useEffect(() => {
    if (openAddOnLoad) window.history.replaceState(null, '', '/');
  }, [openAddOnLoad]);

  const groups = useMemo(() => groupsOf(devices), [devices]);
  // If the last device of a group disappears, fall back to "All" instead of showing an empty filter.
  const activeGroup = group !== null && groups.some((g) => g.name.toLowerCase() === group.toLowerCase()) ? group : null;
  const visible = useMemo(() => filterDevices(devices, query, activeGroup), [devices, query, activeGroup]);
  const groupDevices = useMemo(() => (activeGroup ? filterDevices(devices, '', activeGroup) : []), [devices, activeGroup]);

  /* ---------- keyboard: "/" jumps to search ---------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (searchRef.current) {
        event.preventDefault();
        searchRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- data helpers ---------- */

  const refresh = useCallback(async () => {
    try {
      const { devices: fresh } = await api<{ devices: DeviceDto[] }>('/api/devices');
      setDevices(fresh);
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  }, [api, toast]);

  const setWakeFor = useCallback((id: number, status: WakeStatus | null) => {
    setWake((current) => {
      const next = { ...current };
      if (status) next[id] = status;
      else delete next[id];
      return next;
    });
  }, []);

  const scheduleReset = useCallback(
    (id: number, clearMessage: boolean) => {
      for (const t of timers.current.get(id) ?? []) window.clearTimeout(t);
      const handles = [
        window.setTimeout(() => {
          setWake((current) => (current[id] ? { ...current, [id]: { ...current[id], phase: 'idle' } } : current));
        }, RESET_BUTTON_MS),
      ];
      if (clearMessage) handles.push(window.setTimeout(() => setWakeFor(id, null), CLEAR_MESSAGE_MS));
      timers.current.set(id, handles);
    },
    [setWakeFor],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const handles of pending.values()) for (const t of handles) window.clearTimeout(t);
    };
  }, []);

  /** Asks the server to probe the status port of the given devices (best effort). */
  const runPresence = useCallback(
    async (ids: number[], quiet = false) => {
      if (ids.length === 0) return;
      if (!quiet) setChecking((c) => Object.fromEntries([...Object.entries(c), ...ids.map((id) => [id, true as const])]));
      try {
        const { statuses } = await api<{ statuses: PresenceDto[] }>('/api/devices/status', { method: 'POST', body: { ids } });
        setPresence((current) => {
          const next = { ...current };
          for (const s of statuses) next[s.deviceId] = s;
          return next;
        });
        for (const s of statuses) {
          if (s.state === 'online' && watching.current.has(s.deviceId)) {
            watching.current.delete(s.deviceId);
            const device = devicesRef.current.find((d) => d.id === s.deviceId);
            setWakeFor(s.deviceId, {
              phase: 'idle',
              tone: 'info',
              message:
                s.via === 'refused'
                  ? `It answered (port ${device?.statusPort ?? ''} is closed, but the computer is up).`
                  : `Answering on port ${device?.statusPort ?? ''} — it looks awake.`,
            });
            scheduleReset(s.deviceId, true);
            toast(`${device?.name ?? 'The computer'} is answering.`, 'success');
          }
        }
      } catch (error) {
        if (!quiet) toast(errorMessage(error), 'error');
      } finally {
        if (!quiet) {
          setChecking((c) => {
            const next = { ...c };
            for (const id of ids) delete next[id];
            return next;
          });
        }
      }
    },
    [api, toast, setWakeFor, scheduleReset],
  );

  /* ---------- presence polling: all devices every ~30 s, freshly woken ones every 4 s ---------- */
  useEffect(() => {
    const withStatus = () => devicesRef.current.filter((d) => d.statusPort !== null).map((d) => d.id);
    void runPresence(withStatus(), true);

    let tick = 0;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      tick += 1;
      const now = Date.now();
      for (const [id, until] of [...watching.current]) {
        if (until < now) {
          watching.current.delete(id);
          setWakeFor(id, { phase: 'idle', tone: 'info', message: 'No answer yet. It may still be starting, or the status port is closed.' });
          scheduleReset(id, true);
        }
      }
      const watched = [...watching.current.keys()];
      if (watched.length > 0) void runPresence(watched, true);
      else if (tick % 8 === 0) void runPresence(withStatus(), true);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [runPresence, setWakeFor, scheduleReset]);

  /* ---------- actions ---------- */

  const applyResults = useCallback(
    (results: WakeResultDto[], answeringBefore: Set<number>) => {
      for (const result of results) {
        const device = devicesRef.current.find((d) => d.id === result.deviceId);
        if (!device) continue;
        const wasAnswering = answeringBefore.has(device.id);
        setWakeFor(device.id, describeWake(device, result, wasAnswering));
        // Only keep polling for devices that were asleep: watching one that is already up is pointless.
        const watch = result.result !== 'failed' && device.statusPort !== null && !wasAnswering;
        if (watch) watching.current.set(device.id, Date.now() + WATCH_MS);
        scheduleReset(device.id, !watch);
      }
    },
    [setWakeFor, scheduleReset],
  );

  /** Devices whose last status check said they are up (taken before sending, so the wake does not race it). */
  const answeringNow = useCallback(
    () => new Set(Object.values(presence).filter((p) => p.state === 'online').map((p) => p.deviceId)),
    [presence],
  );

  async function wakeOne(device: DeviceDto) {
    navigator.vibrate?.(14);
    for (const t of timers.current.get(device.id) ?? []) window.clearTimeout(t);
    watching.current.delete(device.id);
    setWakeFor(device.id, { phase: 'sending', message: 'Sending magic packets…' });
    const answering = answeringNow();
    try {
      const { result } = await api<{ result: WakeResultDto }>(`/api/devices/${device.id}/wake`, { method: 'POST' });
      applyResults([result], answering);
    } catch (error) {
      setWakeFor(device.id, { phase: 'failed', tone: 'error', message: errorMessage(error) });
      scheduleReset(device.id, false);
    }
  }

  async function wakeGroup() {
    if (!activeGroup) return;
    setConfirmGroup(false);
    navigator.vibrate?.([14, 40, 14]);
    for (const d of groupDevices) setWakeFor(d.id, { phase: 'sending', message: 'Sending magic packets…' });
    const answering = answeringNow();
    try {
      const { results } = await api<{ results: WakeResultDto[] }>('/api/wake', { method: 'POST', body: { group: activeGroup } });
      applyResults(results, answering);
      const failed = results.filter((r) => r.result === 'failed').length;
      toast(
        failed === 0 ? `Magic packets sent to ${results.length} computer${results.length === 1 ? '' : 's'} in ${activeGroup}.` : `${results.length - failed} sent, ${failed} failed. Check the cards for details.`,
        failed === 0 ? 'success' : 'error',
      );
    } catch (error) {
      for (const d of groupDevices) setWakeFor(d.id, null);
      toast(errorMessage(error), 'error');
    }
  }

  async function move(device: DeviceDto, direction: -1 | 1) {
    const index = devices.findIndex((d) => d.id === device.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= devices.length) return;
    const next = [...devices];
    [next[index], next[target]] = [next[target] as DeviceDto, next[index] as DeviceDto];
    setDevices(next);
    try {
      await api('/api/devices/reorder', { method: 'POST', body: { ids: next.map((d) => d.id) } });
    } catch (error) {
      toast(errorMessage(error), 'error');
      void refresh();
    }
  }

  async function duplicate(device: DeviceDto) {
    setActionsFor(null);
    try {
      await api(`/api/devices/${device.id}/duplicate`, { method: 'POST' });
      await refresh();
      toast(`Duplicated “${device.name}”.`, 'success');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  }

  async function remove(device: DeviceDto) {
    setConfirmDelete(null);
    try {
      await api(`/api/devices/${device.id}`, { method: 'DELETE' });
      setDevices((list) => list.filter((d) => d.id !== device.id));
      watching.current.delete(device.id);
      toast(`Deleted “${device.name}”.`, 'success');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  }

  function saved(device: DeviceDto, created: boolean) {
    setForm({ open: false, device: null });
    setDevices((list) => (created ? [...list, device] : list.map((d) => (d.id === device.id ? device : d))));
    toast(created ? `Added “${device.name}”.` : `Saved “${device.name}”.`, 'success');
    if (device.statusPort !== null) void runPresence([device.id], true);
    else setPresence((p) => Object.fromEntries(Object.entries(p).filter(([id]) => Number(id) !== device.id)));
  }

  const openAdd = () => setForm({ open: true, device: null });
  const empty = devices.length === 0;

  return (
    <div className="page page--wide">
      <header className="page__head">
        <div>
          <h1>Your computers</h1>
          <p>{empty ? 'Nothing here yet.' : `${devices.length} saved · tap the power button to wake one`}</p>
        </div>
        <div className="page__actions">
          {devices.length > 1 && (
            <button type="button" className={`btn btn--ghost btn--sm`} aria-pressed={reorderMode} onClick={() => setReorderMode((v) => !v)}>
              <Icon name={reorderMode ? 'check' : 'reorder'} />
              {reorderMode ? 'Done' : 'Reorder'}
            </button>
          )}
          <button type="button" className="btn only-desktop" onClick={openAdd}>
            <Icon name="plus" />
            Add computer
          </button>
        </div>
      </header>

      {!empty && bannerDismissed === null && (
        <aside className="banner" aria-label="Setup guide">
          <Icon name="guide" width={28} height={28} />
          <div className="banner__text">
            <strong>New to Wake-on-LAN?</strong>
            Computers only wake up if they are set up for it. The 7-step guide walks you through it.
          </div>
          <Link className="btn btn--sm" href="/guide">
            Open guide
          </Link>
          <button type="button" className="icon-btn" aria-label="Dismiss the guide suggestion" onClick={() => setBannerDismissed('1')}>
            <Icon name="x" />
          </button>
        </aside>
      )}

      {empty ? (
        <section className="empty" aria-labelledby="empty-title">
          <EmptyArt className="empty__art" />
          <h2 id="empty-title">Wake your first computer</h2>
          <p>Add its name and MAC address, then wake it from anywhere on your network. There is no limit on how many you can save.</p>
          <div className="empty__actions">
            <button type="button" className="btn btn--accent" onClick={openAdd}>
              <Icon name="plus" />
              Add a computer
            </button>
            <Link className="btn btn--ghost" href="/guide">
              <Icon name="guide" />
              Setup guide
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div className="toolbar">
            {(devices.length >= 4 || query) && (
              <div className="search">
                <Icon name="search" />
                <input
                  ref={searchRef}
                  className="input"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, address, MAC or group   ( / )"
                  aria-label="Search computers"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}
            {groups.length > 0 && !reorderMode && (
              <div className="chips" role="group" aria-label="Filter by group">
                <button type="button" className="chip" aria-pressed={activeGroup === null} onClick={() => setGroup(null)}>
                  All <small>{devices.length}</small>
                </button>
                {groups.map((g) => (
                  <button key={g.name} type="button" className="chip" aria-pressed={activeGroup?.toLowerCase() === g.name.toLowerCase()} onClick={() => setGroup(g.name)}>
                    {g.name} <small>{g.count}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeGroup && !reorderMode && (
            <div className="group-bar">
              <p>
                <strong>{activeGroup}</strong> · {groupDevices.length} computer{groupDevices.length === 1 ? '' : 's'}
              </p>
              <button type="button" className="btn btn--accent btn--sm" onClick={() => setConfirmGroup(true)}>
                <Icon name="power" />
                Wake all
              </button>
            </div>
          )}

          {reorderMode && <p className="field__hint" style={{ marginBottom: 12 }}>Use the arrows to change the order, then tap Done.</p>}

          {visible.length === 0 ? (
            <div className="empty" role="status">
              <h2>No matches</h2>
              <p>
                Nothing matches “{query}”{activeGroup ? ` in ${activeGroup}` : ''}.
              </p>
              <div className="empty__actions">
                <button type="button" className="btn btn--ghost" onClick={() => { setQuery(''); setGroup(null); }}>
                  Clear search
                </button>
              </div>
            </div>
          ) : (
            <ul className="devices" aria-label="Computers">
              {(reorderMode ? devices : visible).map((device, index, list) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  index={index}
                  wake={wake[device.id]}
                  presence={presence[device.id]}
                  checking={Boolean(checking[device.id])}
                  reorderMode={reorderMode}
                  isFirst={index === 0}
                  isLast={index === list.length - 1}
                  onWake={() => void wakeOne(device)}
                  onOpen={() => setActionsFor(device)}
                  onMove={(direction) => void move(device, direction)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {!empty && (
        <button type="button" className="btn btn--accent fab" onClick={openAdd}>
          <Icon name="plus" />
          Add
        </button>
      )}

      {/* add / edit */}
      <DeviceForm
        open={form.open}
        device={form.device}
        settings={settings}
        groups={groups.map((g) => g.name)}
        deviceCount={devices.length}
        onClose={() => setForm({ open: false, device: null })}
        onSaved={saved}
      />

      {/* per-device actions */}
      <Sheet open={actionsFor !== null} onClose={() => setActionsFor(null)} title={actionsFor?.name ?? ''}>
        {actionsFor && (
          <div className="stack">
            <div className="device__main" style={{ cursor: 'default' }}>
              <span className="device__tile" style={{ background: actionsFor.color ? `var(--c-${actionsFor.color})` : 'var(--c-slate)' }}>
                <DeviceGlyph icon={actionsFor.icon} />
              </span>
              <span className="device__text">
                <span className="device__meta">{actionsFor.mac}</span>
                <span className="device__meta">
                  {actionsFor.target}:{actionsFor.port} · {actionsFor.wakeMode === 'remote' ? 'another network' : 'same network'}
                </span>
              </span>
            </div>
            <ul className="action-list">
              <li>
                <button type="button" onClick={() => { const d = actionsFor; setActionsFor(null); setForm({ open: true, device: d }); }}>
                  <Icon name="edit" /> Edit details
                </button>
              </li>
              <li>
                <button type="button" onClick={() => void duplicate(actionsFor)}>
                  <Icon name="copy" /> Duplicate
                </button>
              </li>
              {actionsFor.statusPort !== null && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      const d = actionsFor;
                      setActionsFor(null);
                      void runPresence([d.id]).then(() => toast(`Checked ${d.name} on port ${d.statusPort}. The result is shown on its card.`));
                    }}
                  >
                    <Icon name="refresh" /> Check status now
                  </button>
                </li>
              )}
              <li>
                <hr className="divider" />
              </li>
              <li>
                <button type="button" className="danger" onClick={() => { const d = actionsFor; setActionsFor(null); setConfirmDelete(d); }}>
                  <Icon name="trash" /> Delete…
                </button>
              </li>
            </ul>
          </div>
        )}
      </Sheet>

      {/* confirm delete */}
      <Sheet
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this computer?"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>
              Keep it
            </button>
            <button type="button" className="btn btn--danger" onClick={() => confirmDelete && void remove(confirmDelete)}>
              <Icon name="trash" /> Delete
            </button>
          </>
        }
      >
        <p>
          “{confirmDelete?.name}” will be removed from ConnectWOL. The computer itself is not touched, and its wake history is kept. Deleting cannot be undone, but you can add it again any time.
        </p>
      </Sheet>

      {/* confirm wake group */}
      <Sheet
        open={confirmGroup}
        onClose={() => setConfirmGroup(false)}
        title={`Wake all in ${activeGroup ?? ''}?`}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmGroup(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--accent" onClick={() => void wakeGroup()}>
              <Icon name="power" /> Wake {groupDevices.length}
            </button>
          </>
        }
      >
        <p>Magic packets will be sent to:</p>
        <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>
          {groupDevices.map((d) => (
            <li key={d.id}>{d.name}</li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
