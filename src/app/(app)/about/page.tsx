import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { APP_DESCRIPTION, APP_NAME } from '@/lib/brand';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <div className="page">
      <header className="page__head">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Logo size={56} title={APP_NAME} />
          <div>
            <h1>{APP_NAME}</h1>
            <p>{APP_DESCRIPTION}</p>
          </div>
        </div>
      </header>

      <div className="stack stack--lg">
        <section className="card prose" aria-labelledby="privacy-h">
          <h2 id="privacy-h">Privacy statement</h2>
          <p className="lead">In plain language.</p>
          <p>
            <strong>{APP_NAME} has no accounts with any company, no analytics, no tracking, no ads and no cloud service.</strong> It runs on a computer you control and everything it knows stays there.
          </p>
          <h3>What is stored on your server</h3>
          <ul>
            <li>Your administrator username and a salted Argon2id hash of your password (never the password itself).</li>
            <li>The computers you add: name, MAC address, address, port and, if you enter them, a SecureOn password, icon, colour and group.</li>
            <li>A log of wake attempts (time, computer, result), which you can clear at any time.</li>
            <li>Your settings and the session records that keep you signed in (stored as hashes).</li>
          </ul>
          <p>All of it lives in one SQLite file in the server&apos;s data folder. Delete that folder and everything is gone.</p>
          <h3>What leaves your server</h3>
          <ul>
            <li>The magic packets you send, to the computers you choose.</li>
            <li>Optional status checks: a TCP connection attempt to the address and port you configured.</li>
          </ul>
          <p>Nothing else. {APP_NAME} loads no third-party scripts, fonts, images or trackers; its security policy forbids it, and the browser would block them.</p>
          <h3>In your browser</h3>
          <ul>
            <li>One HTTP-only session cookie that keeps you signed in.</li>
            <li>Your theme choice and a couple of dismissed-hint flags in local storage.</li>
            <li>A service worker that caches the app&apos;s own files so it opens quickly. It never caches your data.</li>
          </ul>
          <h3>Your control</h3>
          <p>
            Export your computers as JSON from <Link href="/settings">Settings</Link>, delete any computer, clear the history, or remove the data folder to erase everything.
          </p>
        </section>

        <section className="card prose" aria-labelledby="honest-h">
          <h2 id="honest-h">An honest note about Wake-on-LAN</h2>
          <p>
            {APP_NAME} sends a standard magic packet. Whether a computer wakes up depends on its hardware, firmware and operating-system settings, on how it is shut down or put to sleep, and on the network between you and it. A packet that was
            sent is not a computer that woke up. The <Link href="/guide">setup guide</Link> covers the settings that matter, and the status check can show when a computer starts answering. It stays best-effort.
          </p>
          <p>
            <Link className="btn btn--ghost btn--sm" href="/guide">
              <Icon name="guide" />
              Open the setup guide
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
