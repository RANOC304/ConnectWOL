'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/brand';
import { useApp } from './AppProvider';
import { Icon, type UiIconName } from './Icons';
import { Logo } from './Logo';

const ITEMS: Array<{ href: string; label: string; icon: UiIconName }> = [
  { href: '/', label: 'Devices', icon: 'power' },
  { href: '/history', label: 'History', icon: 'history' },
  { href: '/guide', label: 'Guide', icon: 'guide' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { username } = useApp();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href) || (href === '/settings' && pathname === '/about'));

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="nav" aria-label="Main">
        <Link className="nav__brand" href="/" aria-label={`${APP_NAME} home`}>
          <Logo size={34} />
          {APP_NAME}
        </Link>
        <ul className="nav__list">
          {ITEMS.map((item) => (
            <li key={item.href}>
              <Link className="nav__link" href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="nav__foot">
          <strong>{username}</strong>
          Signed in on this server
        </div>
      </nav>
      <main id="main" className="main" tabIndex={-1}>
        <div className="topbar">
          <Logo size={30} />
          {APP_NAME}
        </div>
        {children}
      </main>
    </div>
  );
}
