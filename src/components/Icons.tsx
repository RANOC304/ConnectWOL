import type { ReactNode, SVGProps } from 'react';
import type { DeviceIcon } from '@/lib/schemas';

/** Stroke icon set drawn for ConnectWOL (24×24 grid, 1.8 stroke, round caps). */
const UI: Record<string, ReactNode> = {
  power: (
    <>
      <path d="M12 3v8.5" />
      <path d="M6.7 6.5a8 8 0 1 0 10.6 0" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  edit: (
    <>
      <path d="M4 20h4L19.2 8.8a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.2" />
      <path d="M5 15V6.2A2.2 2.2 0 0 1 7.2 4H15" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l.9 11.2A2 2 0 0 0 8.9 20h6.2a2 2 0 0 0 2-1.8L18 7M9 7V4.5h6V7" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  reorder: <path d="M7 4v16M3.5 7.5L7 4l3.5 3.5M17 20V4M13.5 16.5L17 20l3.5-3.5" />,
  history: (
    <>
      <path d="M3.6 12a8.4 8.4 0 1 0 2.5-6" />
      <path d="M3.2 4v4.6h4.6M12 7.5V12l3 2" />
    </>
  ),
  guide: <path d="M5 4.5h11A3 3 0 0 1 19 7.5V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6" />,
  settings: (
    <>
      <path d="M4 7h8M18 7h2M4 17h2M12 17h8" />
      <circle cx="15" cy="7" r="2.4" />
      <circle cx="9" cy="17" r="2.4" />
    </>
  ),
  wifi: <path d="M2.5 9a15 15 0 0 1 19 0M5.6 12.5a10.5 10.5 0 0 1 12.8 0M8.8 16a6 6 0 0 1 6.4 0M12 19.6h.01" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 9l5-5 5 5M5 20h14" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2.2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  logout: <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10M15 8l4 4-4 4M19 12H9" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.6h.01" />
    </>
  ),
  alert: <path d="M12 3.8l9.3 16H2.7zM12 10v4.4M12 17.2h.01" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  'chevron-left': <path d="M15 6l-6 6 6 6" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.7-6M20 4v5h-5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.6A8 8 0 0 1 9.4 4a8 8 0 1 0 10.6 10.6z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2.2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.2" />
      <path d="M7 9l3 3-3 3M12.5 15H17" />
    </>
  ),
  shield: <path d="M12 3l7 3v5.2c0 4.8-3 8.3-7 9.8-4-1.5-7-5-7-9.8V6z" />,
  home: <path d="M4 11l8-7 8 7v8.2a.8.8 0 0 1-.8.8H15v-6H9v6H4.8a.8.8 0 0 1-.8-.8z" />,
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.6" />
      <path d="M11 18.5h2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18" />
    </>
  ),
  plug: <path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
};

/** Device glyphs shown on the coloured tiles and in the icon picker. */
const DEVICE: Record<DeviceIcon, ReactNode> = {
  desktop: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2.2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  laptop: (
    <>
      <rect x="5" y="5" width="14" height="10" rx="1.8" />
      <path d="M2.5 19h19" />
    </>
  ),
  tower: (
    <>
      <rect x="6.5" y="3" width="11" height="18" rx="2.2" />
      <path d="M10 7h4" />
      <circle cx="12" cy="16" r="1.4" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="6.5" rx="1.8" />
      <rect x="3" y="13.5" width="18" height="6.5" rx="1.8" />
      <path d="M7 7.25h.01M7 16.75h.01M11 7.25h6M11 16.75h6" />
    </>
  ),
  nas: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2.4" />
      <path d="M8 7.5h8M8 11.5h8M8 15.5h4" />
      <circle cx="16.2" cy="17.2" r=".9" fill="currentColor" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7.5 8h9a4 4 0 0 1 3.9 4.8l-.8 3.8a2.4 2.4 0 0 1-4 1.3L14 16h-4l-2.6 1.9a2.4 2.4 0 0 1-4-1.3l-.8-3.8A4 4 0 0 1 7.5 8z" />
      <path d="M8.5 10.7v3M7 12.2h3M15.6 11.4h.01M17.4 13h.01" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2.2" />
      <path d="M8 3.5L12 8l4-4.5" />
    </>
  ),
  pi: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2.2" />
      <rect x="9" y="10" width="6" height="6" rx="1" />
      <path d="M6.5 7V4.5M10 7V4.5M14 7V4.5M17.5 7V4.5" />
    </>
  ),
  router: (
    <>
      <rect x="3" y="12.5" width="18" height="7" rx="2.2" />
      <path d="M7 16h.01M11 16h.01M7 12.5V6.5M17 12.5V6.5" />
    </>
  ),
};

export type UiIconName = keyof typeof UI;

type SvgProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

function Svg({ children, ...props }: SvgProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Icon({ name, ...props }: SvgProps & { name: UiIconName }) {
  return <Svg {...props}>{UI[name]}</Svg>;
}

export function DeviceGlyph({ icon, ...props }: SvgProps & { icon: DeviceIcon | null | undefined }) {
  return <Svg {...props}>{DEVICE[icon ?? 'desktop']}</Svg>;
}

export const DEVICE_ICON_LABELS: Record<DeviceIcon, string> = {
  desktop: 'Desktop',
  laptop: 'Laptop',
  tower: 'Tower PC',
  server: 'Server',
  nas: 'NAS',
  gamepad: 'Gaming PC',
  tv: 'TV / media',
  pi: 'Raspberry Pi / board',
  router: 'Router / network',
};
