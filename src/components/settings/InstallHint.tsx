'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from '../Icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const noopSubscribe = () => () => undefined;

function detect(): string {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'other';
}

/** Install-to-home-screen help: native prompt where available, Share-sheet steps on iOS. */
export function InstallHint() {
  const platform = useSyncExternalStore(noopSubscribe, detect, () => 'unknown');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (platform === 'unknown') return null;
  if (platform === 'installed') {
    return (
      <div className="alert alert--ok">
        <Icon name="check" />
        <span>ConnectWOL is installed on this device.</span>
      </div>
    );
  }

  return (
    <div className="stack">
      {deferred ? (
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          }}
        >
          <Icon name="download" />
          Install ConnectWOL
        </button>
      ) : platform === 'ios' ? (
        <p>
          In Safari, tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>. ConnectWOL then opens full-screen like an app.
        </p>
      ) : (
        <p>
          In Chrome or Edge, open the browser menu and choose <strong>Install app</strong> (or <strong>Add to Home screen</strong> on Android). Browsers only offer installing over HTTPS or on <code>localhost</code>, so
          for a phone, reach the server through your VPN or reverse proxy with HTTPS.
        </p>
      )}
    </div>
  );
}
