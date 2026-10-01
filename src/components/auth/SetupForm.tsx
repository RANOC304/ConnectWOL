'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { APP_NAME } from '@/lib/brand';
import { LIMITS } from '@/lib/schemas';
import { Icon } from '../Icons';
import { Logo } from '../Logo';

export function SetupForm({ needsToken }: { needsToken: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setErrors({ confirm: 'The two passwords do not match.' });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, ...(needsToken ? { setupToken: token } : {}) }),
      });
      if (response.ok) {
        router.replace('/');
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string> } } | null;
      setErrors({ ...(data?.error?.fields ?? {}), _: data?.error?.fields ? '' : (data?.error?.message ?? 'Setup failed.') });
      setBusy(false);
    } catch {
      setErrors({ _: 'Could not reach the server.' });
      setBusy(false);
    }
  }

  return (
    <div className="auth__card">
      <div className="auth__brand">
        <Logo size={44} />
        <span>{APP_NAME}</span>
      </div>
      <h1>Create your account</h1>
      <p className="auth__lead">
        This is the only account. It protects the app, because anyone who can open it can wake your computers. Nothing leaves this server.
      </p>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={errors.username ? 'username-err' : undefined}
            required
          />
          {errors.username && (
            <p id="username-err" className="field__error">
              {errors.username}
            </p>
          )}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="password">
            Password <small>(at least {LIMITS.passwordMin} characters)</small>
          </label>
          <input
            id="password"
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-err' : 'password-hint'}
            required
          />
          {errors.password ? (
            <p id="password-err" className="field__error">
              {errors.password}
            </p>
          ) : (
            <p id="password-hint" className="field__hint">
              A few random words make a strong, easy-to-type passphrase.
            </p>
          )}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="confirm">
            Repeat password
          </label>
          <input
            id="confirm"
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch || Boolean(errors.confirm)}
            required
          />
          {(mismatch || errors.confirm) && <p className="field__error">The two passwords do not match.</p>}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.92rem' }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ width: 20, height: 20 }} />
          Show passwords
        </label>
        {needsToken && (
          <div className="field">
            <label className="field__label" htmlFor="token">
              Setup token
            </label>
            <input id="token" className="input input--mono" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} required />
            <p className="field__hint">The server owner set a SETUP_TOKEN. Find it in the server&apos;s environment or .env file.</p>
          </div>
        )}
        {errors._ && (
          <div className="alert alert--error" role="alert">
            <Icon name="alert" />
            <span>{errors._}</span>
          </div>
        )}
        <button className="btn btn--block" type="submit" disabled={busy || !username || !password || !confirm}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="shield" />}
          {busy ? 'Creating…' : 'Create account & continue'}
        </button>
      </form>
    </div>
  );
}
