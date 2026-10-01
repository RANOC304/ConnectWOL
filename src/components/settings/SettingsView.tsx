'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, errorMessage } from '@/lib/api-client';
import { LIMITS } from '@/lib/schemas';
import type { SettingsDto } from '@/lib/types';
import { useLocalStorage } from '@/lib/use-local-storage';
import { useApp } from '../AppProvider';
import { Icon } from '../Icons';
import { Sheet } from '../Sheet';
import { InstallHint } from './InstallHint';

type Theme = 'system' | 'light' | 'dark';

function ThemeCard() {
  const [stored, setStored] = useLocalStorage('cwol-theme', null);
  const theme: Theme = stored === 'light' || stored === 'dark' ? stored : 'system';

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  const options: Array<[Theme, string]> = [
    ['system', 'System'],
    ['light', 'Light'],
    ['dark', 'Dark'],
  ];
  return (
    <section className="card" aria-labelledby="theme-h">
      <h2 id="theme-h">Appearance</h2>
      <p className="lead">Saved in this browser only, so your phone and laptop can differ.</p>
      <div className="seg" role="radiogroup" aria-label="Theme">
        {options.map(([value, label]) => (
          <label key={value}>
            <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setStored(value === 'system' ? null : value)} />
            {label}
          </label>
        ))}
      </div>
    </section>
  );
}

function DefaultsCard({ initial }: { initial: SettingsDto }) {
  const { api, toast } = useApp();
  const [port, setPort] = useState(String(initial.defaultPort));
  const [repeat, setRepeat] = useState(String(initial.repeatCount));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const { settings } = await api<{ settings: SettingsDto }>('/api/settings', { method: 'PUT', body: { defaultPort: port, repeatCount: repeat } });
      setPort(String(settings.defaultPort));
      setRepeat(String(settings.repeatCount));
      toast('Wake defaults saved.', 'success');
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) setErrors(error.fields);
      else toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="defaults-h">
      <h2 id="defaults-h">Wake defaults</h2>
      <p className="lead">UDP is unreliable, so every magic packet is sent several times.</p>
      <form className="form" onSubmit={save} noValidate>
        <div className="row">
          <div className="field">
            <label className="field__label" htmlFor="default-port">
              Default UDP port
            </label>
            <input id="default-port" className="input input--mono" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} aria-invalid={Boolean(errors.defaultPort)} />
            <p className={errors.defaultPort ? 'field__error' : 'field__hint'}>{errors.defaultPort ?? 'Pre-filled for new computers. 9 is the usual choice.'}</p>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="repeat">
              Packet repeats
            </label>
            <input id="repeat" className="input input--mono" inputMode="numeric" value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-invalid={Boolean(errors.repeatCount)} />
            <p className={errors.repeatCount ? 'field__error' : 'field__hint'}>{errors.repeatCount ?? `Times each packet is sent (${LIMITS.repeatMin}–${LIMITS.repeatMax}).`}</p>
          </div>
        </div>
        <div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" />}
            Save defaults
          </button>
        </div>
      </form>
    </section>
  );
}

interface ImportOutcome {
  imported: number;
  skipped: number;
  replaced: boolean;
}

function BackupCard() {
  const { api, toast } = useApp();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ count: number; body: unknown } | null>(null);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [problems, setProblems] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    setProblems([]);
    setOutcome(null);
    setParsed(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setProblems(['That file is larger than 5 MB, which is far more than a device list needs.']);
      return;
    }
    try {
      const body: unknown = JSON.parse(await file.text());
      const list = (body as { devices?: unknown } | null)?.devices;
      if (!Array.isArray(list)) throw new Error('shape');
      setParsed({ count: list.length, body });
    } catch {
      setProblems(['This is not a ConnectWOL export. Choose a .json file created with “Export devices”.']);
    }
  }

  async function runImport() {
    if (!parsed) return;
    setConfirmReplace(false);
    setBusy(true);
    setProblems([]);
    try {
      const result = await api<ImportOutcome>('/api/devices/import', { method: 'POST', body: { ...(parsed.body as object), mode } });
      setOutcome(result);
      toast(`Imported ${result.imported} computer${result.imported === 1 ? '' : 's'}.`, 'success');
      setParsed(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) {
        setProblems([error.message, ...Object.entries(error.fields).slice(0, 8).map(([k, v]) => `${k.replace(/^devices\.(\d+)\./, (_m, i: string) => `#${Number(i) + 1} · `)}: ${v}`)]);
      } else {
        setProblems([errorMessage(error)]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="backup-h">
      <h2 id="backup-h">Backup & restore</h2>
      <p className="lead">Export your computers as a JSON file and import them on another server. The file includes SecureOn passwords, so keep it private.</p>
      <div className="stack">
        <div>
          <a className="btn btn--ghost" href="/api/devices/export" download>
            <Icon name="download" />
            Export devices
          </a>
        </div>
        <hr className="divider" />
        <div className="field">
          <label className="field__label" htmlFor="import-file">
            Import devices
          </label>
          <input id="import-file" ref={fileRef} className="input" type="file" accept="application/json,.json" onChange={(e) => void onFile(e.target.files?.[0])} />
          {fileName && parsed && <p className="field__hint">{fileName}: {parsed.count} computer{parsed.count === 1 ? '' : 's'} found.</p>}
        </div>
        {parsed && (
          <>
            <div className="seg" role="radiogroup" aria-label="Import mode" style={{ justifySelf: 'start' }}>
              <label>
                <input type="radio" name="import-mode" checked={mode === 'append'} onChange={() => setMode('append')} />
                Add to my list
              </label>
              <label>
                <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                Replace my list
              </label>
            </div>
            <p className="field__hint">{mode === 'append' ? 'Computers that already exist (same name, MAC, address and port) are skipped.' : 'Every computer currently saved here is removed first.'}</p>
            <div>
              <button type="button" className={`btn ${mode === 'replace' ? 'btn--danger' : ''}`} disabled={busy} onClick={() => (mode === 'replace' ? setConfirmReplace(true) : void runImport())}>
                {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="upload" />}
                Import {parsed.count} computer{parsed.count === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}
        {problems.length > 0 && (
          <div className="alert alert--error" role="alert">
            <Icon name="alert" />
            <div>
              {problems.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        )}
        {outcome && (
          <div className="alert alert--ok" role="status">
            <Icon name="check" />
            <span>
              Imported {outcome.imported}
              {outcome.skipped > 0 ? `, skipped ${outcome.skipped} that already existed` : ''}. <Link href="/">See your computers</Link>.
            </span>
          </div>
        )}
      </div>
      <Sheet
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title="Replace all computers?"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmReplace(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--danger" onClick={() => void runImport()}>
              Replace list
            </button>
          </>
        }
      >
        <p>Your current list is removed and replaced by the {parsed?.count ?? 0} computers in the file. Tip: export first if you might want the old list back.</p>
      </Sheet>
    </section>
  );
}

function SecurityCard() {
  const { api, toast, username } = useApp();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function change(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api('/api/auth/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      setCurrent('');
      setNext('');
      toast('Password changed. Other devices were signed out.', 'success');
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) setErrors(error.fields);
      else toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <section className="card" aria-labelledby="security-h">
      <h2 id="security-h">Account & security</h2>
      <p className="lead">
        Signed in as <strong>{username}</strong>.
      </p>
      <form className="form" onSubmit={change} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="current-password">
            Current password
          </label>
          <input id="current-password" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={Boolean(errors.currentPassword)} />
          {errors.currentPassword && <p className="field__error">{errors.currentPassword}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="new-password">
            New password <small>(at least {LIMITS.passwordMin} characters)</small>
          </label>
          <input id="new-password" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={Boolean(errors.newPassword)} />
          {errors.newPassword && <p className="field__error">{errors.newPassword}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" type="submit" disabled={busy || !current || !next}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="lock" />}
            Change password
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => void signOut()}>
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      </form>
    </section>
  );
}

export function SettingsView({ settings }: { settings: SettingsDto }) {
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Settings</h1>
          <p>Everything is stored on this server.</p>
        </div>
      </header>
      <div className="stack stack--lg">
        <ThemeCard />
        <DefaultsCard initial={settings} />
        <section className="card" aria-labelledby="install-h">
          <h2 id="install-h">Install on your phone</h2>
          <p className="lead">Add ConnectWOL to your home screen to open it like a native app.</p>
          <InstallHint />
        </section>
        <BackupCard />
        <SecurityCard />
        <section className="card" aria-labelledby="about-h">
          <h2 id="about-h">About & privacy</h2>
          <p className="lead">What ConnectWOL stores, and what it never does.</p>
          <Link className="btn btn--ghost" href="/about">
            <Icon name="shield" />
            About ConnectWOL
          </Link>
        </section>
      </div>
    </div>
  );
}
