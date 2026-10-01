'use client';

import { useId, useMemo, useState, type FormEvent } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { suggestColor } from '@/lib/device-view';
import { DEVICE_COLORS, DEVICE_ICONS, LIMITS, deviceCreateSchema, fieldErrors, type DeviceColor, type DeviceIcon, type WakeModeValue } from '@/lib/schemas';
import type { DeviceDto, SettingsDto } from '@/lib/types';
import { parseMac, parseSecureOn } from '@/lib/wol/mac';
import { useApp } from '../AppProvider';
import { DEVICE_ICON_LABELS, DeviceGlyph, Icon } from '../Icons';
import { Sheet } from '../Sheet';

interface Props {
  open: boolean;
  /** Device being edited, or null to add a new one. */
  device: DeviceDto | null;
  settings: SettingsDto;
  groups: string[];
  deviceCount: number;
  onClose: () => void;
  onSaved: (device: DeviceDto, created: boolean) => void;
}

interface FormState {
  name: string;
  mac: string;
  target: string;
  port: string;
  wakeMode: WakeModeValue;
  broadcast: string;
  secureOn: string;
  icon: DeviceIcon;
  color: DeviceColor;
  groupName: string;
  statusPort: string;
}

const STATUS_PRESETS: Array<[number, string]> = [
  [22, 'SSH'],
  [80, 'HTTP'],
  [443, 'HTTPS'],
  [445, 'SMB file sharing'],
  [3389, 'Remote Desktop (RDP)'],
  [5900, 'VNC'],
];

function initialState(device: DeviceDto | null, settings: SettingsDto, deviceCount: number): FormState {
  if (device) {
    return {
      name: device.name,
      mac: device.mac,
      target: device.target,
      port: String(device.port),
      wakeMode: device.wakeMode,
      broadcast: device.broadcast ?? '',
      secureOn: device.secureOn ?? '',
      icon: device.icon ?? 'desktop',
      color: device.color ?? 'slate',
      groupName: device.groupName ?? '',
      statusPort: device.statusPort === null ? '' : String(device.statusPort),
    };
  }
  return {
    name: '',
    mac: '',
    target: '',
    port: String(settings.defaultPort),
    wakeMode: 'local',
    broadcast: '',
    secureOn: '',
    icon: 'desktop',
    color: suggestColor(deviceCount),
    groupName: '',
    statusPort: '',
  };
}

export function DeviceForm(props: Props) {
  const { open, device, onClose } = props;
  const formId = useId();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={device ? 'Edit computer' : 'Add a computer'}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn">
            <Icon name="check" />
            {device ? 'Save changes' : 'Add computer'}
          </button>
        </>
      }
    >
      {/* Keyed so the form starts fresh each time the sheet opens for a different device. */}
      <FormBody key={device?.id ?? 'new'} formId={formId} {...props} />
    </Sheet>
  );
}

function Msg({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  return (
    <p id={id} className={error ? 'field__error' : 'field__hint'}>
      {error ?? hint}
    </p>
  );
}

function FormBody({ formId, device, settings, groups, deviceCount, onSaved }: Props & { formId: string }) {
  const { api, toast } = useApp();
  const [state, setState] = useState<FormState>(() => initialState(device, settings, deviceCount));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    setServerErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };
  const blur = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  const payload = useMemo(
    () => ({
      name: state.name,
      mac: state.mac,
      target: state.target,
      port: state.port,
      wakeMode: state.wakeMode,
      broadcast: state.broadcast,
      secureOn: state.secureOn,
      icon: state.icon,
      color: state.color,
      groupName: state.groupName,
      statusPort: state.statusPort,
    }),
    [state],
  );

  // Same schema the server uses, so what the form accepts is exactly what the API accepts.
  const clientErrors = useMemo(() => {
    const result = deviceCreateSchema.safeParse(payload);
    return result.success ? {} : fieldErrors(result.error);
  }, [payload]);

  const macPreview = state.mac.trim() ? parseMac(state.mac) : null;
  const securePreview = state.secureOn.trim() ? parseSecureOn(state.secureOn) : null;

  const errorFor = (key: string): string | undefined => {
    if (serverErrors[key]) return serverErrors[key];
    return touched[key] || submitted ? clientErrors[key] : undefined;
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(clientErrors).length > 0) {
      const first = Object.keys(clientErrors)[0];
      document.getElementById(`${formId}-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (device) {
        const { device: saved } = await api<{ device: DeviceDto }>(`/api/devices/${device.id}`, { method: 'PATCH', body: payload });
        onSaved(saved, false);
      } else {
        const { device: saved } = await api<{ device: DeviceDto }>('/api/devices', { method: 'POST', body: payload });
        onSaved(saved, true);
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) {
        setServerErrors(error.fields);
        document.getElementById(`${formId}-${Object.keys(error.fields)[0]}`)?.focus();
      } else {
        toast(error instanceof Error ? error.message : 'Could not save the computer.', 'error');
      }
      setBusy(false);
    }
  }

  const field = (key: keyof FormState) => ({
    id: `${formId}-${key}`,
    'aria-invalid': errorFor(key) ? true : undefined,
    'aria-describedby': `${formId}-${key}-msg`,
    onBlur: () => blur(key),
  });

  const m = (name: keyof FormState) => ({ id: `${formId}-${name}-msg`, error: errorFor(name) });

  const remote = state.wakeMode === 'remote';

  return (
    <form id={formId} className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={`${formId}-name`}>
          Name
        </label>
        <input {...field('name')} className="input" value={state.name} onChange={(e) => set('name', e.target.value)} placeholder="Gaming PC" maxLength={LIMITS.nameMax} autoComplete="off" data-autofocus={device ? undefined : ''} />
        <Msg {...m('name')} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`${formId}-mac`}>
          MAC address
        </label>
        <input
          {...field('mac')}
          className="input input--mono"
          value={state.mac}
          onChange={(e) => set('mac', e.target.value)}
          placeholder="AA:BB:CC:DD:EE:FF"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
        />
        {macPreview?.ok && !errorFor('mac') ? <p className="field__ok">✓ Saved as {macPreview.mac}</p> : <Msg {...m('mac')} hint="Any format works: AA:BB:CC:DD:EE:FF, AA-BB-…, AABB.CCDD.EEFF or plain hex. The setup guide shows where to find it." />}
      </div>

      <div className="row row--3">
        <div className="field">
          <label className="field__label" htmlFor={`${formId}-target`}>
            {remote ? 'Public address' : 'IP address or host name'}
          </label>
          <input
            {...field('target')}
            className="input input--mono"
            value={state.target}
            onChange={(e) => set('target', e.target.value)}
            placeholder={remote ? 'home.example.org' : '192.168.1.50'}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <Msg {...m('target')} hint={remote ? 'DDNS name or public IP of the network the computer is on.' : 'Used to pick the right network and for the optional status check.'} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${formId}-port`}>
            UDP port
          </label>
          <input {...field('port')} className="input input--mono" value={state.port} onChange={(e) => set('port', e.target.value)} inputMode="numeric" autoComplete="off" />
          <Msg {...m('port')} hint="Usually 9 (or 7)." />
        </div>
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ padding: 0 }}>
          Icon
        </legend>
        <div className="picker" role="radiogroup" aria-label="Icon">
          {DEVICE_ICONS.map((icon) => (
            <label key={icon} title={DEVICE_ICON_LABELS[icon]}>
              <input type="radio" name={`${formId}-icon`} value={icon} checked={state.icon === icon} onChange={() => set('icon', icon)} aria-label={DEVICE_ICON_LABELS[icon]} />
              <DeviceGlyph icon={icon} />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ padding: 0 }}>
          Colour
        </legend>
        <div className="picker picker--color" role="radiogroup" aria-label="Colour">
          {DEVICE_COLORS.map((color) => (
            <label key={color} style={{ ['--sw' as string]: `var(--c-${color})` }} title={color}>
              <input type="radio" name={`${formId}-color`} value={color} checked={state.color === color} onChange={() => set('color', color)} aria-label={color} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor={`${formId}-groupName`}>
          Group <small>(optional)</small>
        </label>
        <input {...field('groupName')} className="input" value={state.groupName} onChange={(e) => set('groupName', e.target.value)} placeholder="Office, Lab, Family…" list={`${formId}-groups`} maxLength={LIMITS.groupMax} autoComplete="off" />
        <datalist id={`${formId}-groups`}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <Msg {...m('groupName')} hint="Groups let you filter the list and wake several computers at once." />
      </div>

      <details className="adv" open={Boolean(device && (device.broadcast || device.secureOn || device.statusPort || device.wakeMode === 'remote'))}>
        <summary>
          Advanced options
          <Icon name="chevron-down" />
        </summary>
        <div className="adv__body">
          <div className="field">
            <span className="field__label" id={`${formId}-mode-label`}>
              How to reach it
            </span>
            <div className="seg" role="radiogroup" aria-labelledby={`${formId}-mode-label`}>
              <label>
                <input type="radio" name={`${formId}-mode`} checked={state.wakeMode === 'local'} onChange={() => set('wakeMode', 'local')} />
                Same network
              </label>
              <label>
                <input type="radio" name={`${formId}-mode`} checked={state.wakeMode === 'remote'} onChange={() => set('wakeMode', 'remote')} />
                Another network
              </label>
            </div>
            <p className="field__hint">
              {remote
                ? 'Sends the packet directly to the address above (unicast). Use it for a computer on a different network, reached through a forwarded UDP port or a VPN route.'
                : 'Broadcasts on the local network of the machine running ConnectWOL. This is what most setups need.'}
            </p>
          </div>

          {!remote && (
            <div className="field">
              <label className="field__label" htmlFor={`${formId}-broadcast`}>
                Broadcast address <small>(optional)</small>
              </label>
              <input {...field('broadcast')} className="input input--mono" value={state.broadcast} onChange={(e) => set('broadcast', e.target.value)} placeholder="192.168.1.255" autoComplete="off" spellCheck={false} />
              <Msg {...m('broadcast')} hint="Leave empty to detect it automatically. Set it when the computer is on another subnet that the server is attached to." />
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor={`${formId}-secureOn`}>
              SecureOn password <small>(optional)</small>
            </label>
            <input {...field('secureOn')} className="input input--mono" value={state.secureOn} onChange={(e) => set('secureOn', e.target.value)} placeholder="4 or 6 bytes, e.g. 11:22:33:44:55:66" autoComplete="off" spellCheck={false} />
            {securePreview?.ok && !errorFor('secureOn') ? <p className="field__ok">✓ {securePreview.bytes.length} bytes: {securePreview.password}</p> : <Msg {...m('secureOn')} hint="Only needed if your network card is set up for SecureOn. Sent in clear text inside the packet." />}
          </div>

          <div className="field">
            <label className="field__label" htmlFor={`${formId}-statusPort`}>
              Status check port <small>(optional)</small>
            </label>
            <input {...field('statusPort')} className="input input--mono" value={state.statusPort} onChange={(e) => set('statusPort', e.target.value)} placeholder="3389" inputMode="numeric" list={`${formId}-ports`} autoComplete="off" />
            <datalist id={`${formId}-ports`}>
              {STATUS_PRESETS.map(([port, label]) => (
                <option key={port} value={port}>
                  {label}
                </option>
              ))}
            </datalist>
            <Msg {...m('statusPort')} hint="A TCP port that is open while the computer runs (3389 for Remote Desktop, 22 for SSH…). ConnectWOL tries to connect to it to show whether the computer seems online. Best effort only." />
          </div>
        </div>
      </details>

      {busy && (
        <p className="field__hint" role="status">
          Saving…
        </p>
      )}
    </form>
  );
}
