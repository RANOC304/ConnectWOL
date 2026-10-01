'use client';

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useLocalStorage } from '@/lib/use-local-storage';
import { Icon, type UiIconName } from '../Icons';

/* ---------- Callout ---------- */

const CALLOUT_ICON: Record<'note' | 'tip' | 'warn', UiIconName> = { note: 'info', tip: 'sparkle', warn: 'alert' };

export function Callout({ kind = 'note', title, children }: { kind?: 'note' | 'tip' | 'warn'; title?: string; children: ReactNode }) {
  return (
    <div className={`callout${kind === 'note' ? '' : ` callout--${kind}`}`} role={kind === 'warn' ? 'note' : undefined}>
      <Icon name={CALLOUT_ICON[kind]} />
      <div className="callout__body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/* ---------- Code block with copy button ---------- */

export function CodeBlock({ code, label = 'Terminal' }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code.replace(/^\$ /gm, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is unavailable on plain-HTTP origins; the text stays selectable.
    }
  }

  return (
    <div className="code">
      <div className="code__bar">
        <span>{label}</span>
        <button type="button" className="code__copy" onClick={() => void copy()}>
          <Icon name={copied ? 'check' : 'copy'} />
          {copied ? 'Copied' : 'Copy'}
          <span className="sr-only" role="status">
            {copied ? 'Copied to clipboard' : ''}
          </span>
        </button>
      </div>
      <pre tabIndex={0} aria-label={`${label} commands`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ---------- Tabs (WAI-ARIA tabs pattern: arrow keys, Home/End) ---------- */

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs, label }: { tabs: TabDef[]; label: string }) {
  const baseId = useId();
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const focusTab = useCallback((id: string) => {
    setActive(id);
    refs.current.get(id)?.focus();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === active);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[next];
    if (target) focusTab(target.id);
  }

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) refs.current.set(tab.id, el);
              else refs.current.delete(tab.id);
            }}
            role="tab"
            type="button"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`${baseId}-panel-${tab.id}`} aria-labelledby={`${baseId}-tab-${tab.id}`} hidden={active !== tab.id} tabIndex={0}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}

/* ---------- Checklist, remembered per browser ---------- */

export function Checklist({ id, items }: { id: string; items: ReactNode[] }) {
  const [raw, setRaw] = useLocalStorage(`cwol-guide-check-${id}`, null);
  let checked: number[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) checked = parsed.filter((n): n is number => Number.isInteger(n));
  } catch {
    checked = [];
  }

  function toggle(index: number) {
    const next = checked.includes(index) ? checked.filter((i) => i !== index) : [...checked, index];
    setRaw(JSON.stringify(next));
  }

  return (
    <ul className="checklist">
      {items.map((item, index) => (
        <li key={index}>
          <label>
            <input type="checkbox" checked={checked.includes(index)} onChange={() => toggle(index)} />
            <span>{item}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Accordion of <details> ---------- */

export function Accordion({ items, openFirst = false }: { items: Array<{ id: string; title: string; body: ReactNode }>; openFirst?: boolean }) {
  return (
    <div className="accordion">
      {items.map((item, index) => (
        <details key={item.id} id={item.id} open={openFirst && index === 0}>
          <summary>
            {item.title}
            <Icon name="chevron-down" />
          </summary>
          <div className="acc__body">{item.body}</div>
        </details>
      ))}
    </div>
  );
}
