'use client';

import { useEffect } from 'react';

/** Registers the service worker (app-shell cache + offline page). Production only. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Not fatal: the app works without it (plain HTTP on a LAN address cannot register one).
    });
  }, []);
  return null;
}
