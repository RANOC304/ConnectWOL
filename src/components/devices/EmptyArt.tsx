import { useId } from 'react';

/** A sleepy computer under a rising sun. Colours follow the theme tokens. */
export function EmptyArt({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 320 210" role="img" aria-label="A sleeping computer with the sun rising behind it" focusable="false">
      <defs>
        <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffbe62" />
          <stop offset="0.55" stopColor="#ff7a3d" />
          <stop offset="1" stopColor="#ff4f6d" />
        </linearGradient>
        <clipPath id={`${id}-horizon`}>
          <rect x="0" y="0" width="320" height="168" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-horizon)`}>
        <circle cx="160" cy="150" r="78" fill={`url(#${id}-sun)`} opacity="0.95" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const angle = (-165 + i * 25) * (Math.PI / 180);
          const x1 = 160 + Math.cos(angle) * 92;
          const y1 = 150 + Math.sin(angle) * 92;
          const x2 = 160 + Math.cos(angle) * 108;
          const y2 = 150 + Math.sin(angle) * 108;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" opacity="0.55" />;
        })}
      </g>

      <path d="M18 168h284" stroke="var(--line-strong)" strokeWidth="3" strokeLinecap="round" />

      {/* monitor */}
      <rect x="98" y="72" width="124" height="82" rx="12" fill="var(--surface)" stroke="var(--ink)" strokeWidth="4" />
      <rect x="108" y="82" width="104" height="62" rx="6" fill="var(--surface-2)" />
      <path d="M142 168l6-14h24l6 14" fill="var(--surface)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
      <path d="M126 168h68" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />

      {/* closed eyes + tiny smile */}
      <path d="M134 112q8 8 16 0M170 112q8 8 16 0" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <path d="M154 126q6 5 12 0" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />

      {/* zZ */}
      <g fill="none" stroke="var(--accent-text)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M232 62h14l-14 16h14" strokeWidth="4.5" />
        <path d="M254 38h10l-10 11.5h10" strokeWidth="3.8" />
        <path d="M272 20h7l-7 8h7" strokeWidth="3.2" />
      </g>

      {/* signal arcs: a packet on its way */}
      <g fill="none" stroke="var(--muted)" strokeWidth="3.5" strokeLinecap="round" opacity="0.8">
        <path d="M52 116q-9 12 0 24" />
        <path d="M40 108q-17 20 0 40" />
        <path d="M28 100q-25 28 0 56" opacity="0.5" />
      </g>
    </svg>
  );
}
