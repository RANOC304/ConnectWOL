import { useId } from 'react';

/**
 * ConnectWOL mark: a power glyph on a "first light" tile. The ring is the machine, the bar is the
 * signal that wakes it, the gradient is the sunrise.
 */
export function Logo({ size = 36, title }: { size?: number; title?: string }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffbe62" />
          <stop offset="0.5" stopColor="#ff7a3d" />
          <stop offset="1" stopColor="#ff4f6d" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${id}-g)`} />
      <g fill="none" stroke="#1d1008" strokeWidth="3.6" strokeLinecap="round">
        <path d="M24 10.5v12" />
        <path d="M15.6 15.4a12.5 12.5 0 1 0 16.8 0" />
      </g>
      <circle cx="36.5" cy="11.5" r="2.1" fill="#1d1008" opacity="0.85" />
    </svg>
  );
}
