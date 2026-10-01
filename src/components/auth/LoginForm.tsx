'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { APP_NAME } from '@/lib/brand';
import { Icon } from '../Icons';
import { Logo } from '../Logo';

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        router.replace('/');
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(data?.error?.message ?? 'Sign-in failed.');
      setBusy(false);
    } catch {
      setError('Could not reach the server.');
      setBusy(false);
    }
  }

  return (
    <div className="auth__card">
      <div className="auth__brand">
        <Logo size={44} />
        <span>{APP_NAME}</span>
      </div>
      <h1>Welcome back</h1>
      <p className="auth__lead">Sign in to wake your computers.</p>
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
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div className="alert alert--error" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        )}
        <button className="btn btn--block" type="submit" disabled={busy || !username || !password}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="lock" />}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth__foot">Your session lasts 30 days on this device and stays on this server.</p>
    </div>
  );
}
