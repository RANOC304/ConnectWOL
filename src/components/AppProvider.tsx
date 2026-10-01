'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createApi, type ApiFn } from '@/lib/api-client';
import { Icon } from './Icons';

export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface AppContextValue {
  username: string;
  api: ApiFn;
  toast: (message: string, kind?: ToastKind) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}

export function AppProvider({ csrfToken, username, children }: { csrfToken: string; username: string; children: ReactNode }) {
  const router = useRouter();
  // The CSRF token only changes if the server rotates it; a stale one is repaired by the API client.
  const [csrf, setCsrf] = useState(csrfToken);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const api = useMemo(
    () => createApi({ getCsrf: () => csrf, setCsrf, onUnauthorized: () => router.replace('/login') }),
    [csrf, router],
  );

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [setToasts]);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500);
    },
    [dismiss, setToasts],
  );

  const value = useMemo(() => ({ username, api, toast }), [username, api, toast]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info'} />
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <Icon name="x" width={18} height={18} />
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
