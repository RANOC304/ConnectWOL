'use client';

import { useCallback, useSyncExternalStore } from 'react';

const EVENT = 'cwol-storage';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode, blocked storage…
  }
}

/**
 * Reads a localStorage string as external state: SSR-safe (returns `fallback` on the server and
 * during hydration), updates across tabs and across components in the same tab.
 */
export function useLocalStorage(key: string, fallback: string | null = null): [string | null, (value: string | null) => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) callback();
      };
      window.addEventListener('storage', onStorage);
      window.addEventListener(EVENT, callback);
      return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(EVENT, callback);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => fallback,
  );

  const set = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        // ignore: the in-memory UI state below still updates via the event
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set];
}
