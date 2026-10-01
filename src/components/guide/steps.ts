export interface StepMeta {
  n: number;
  title: string;
  summary: string;
  minutes: number;
}

/** The seven setup steps, in order. Content lives in Steps.tsx. */
export const STEPS: readonly StepMeta[] = [
  { n: 1, title: 'Check compatibility', summary: 'Wired or Wi-Fi, and which power states can be woken.', minutes: 3 },
  { n: 2, title: 'Enable it in the BIOS / UEFI', summary: 'The firmware switch that keeps the network card listening.', minutes: 5 },
  { n: 3, title: 'Network adapter settings', summary: 'Windows, macOS and Linux: arm the adapter for magic packets.', minutes: 6 },
  { n: 4, title: 'Windows power settings', summary: 'Fast Startup and the power-saving options that block waking.', minutes: 4 },
  { n: 5, title: 'Find the MAC and IP address', summary: 'Where to read them on each OS, and how to pin the IP on your router.', minutes: 5 },
  { n: 6, title: 'Test on your network', summary: 'Send a real wake packet from here and see what happens.', minutes: 3 },
  { n: 7, title: 'Wake from anywhere', summary: 'VPN or HTTPS first; port forwarding, static ARP and DDNS for the advanced route.', minutes: 8 },
] as const;

export const TROUBLESHOOTING_SLUG = 'troubleshooting';

export const STEP_SLUGS: readonly string[] = [...STEPS.map((s) => String(s.n)), TROUBLESHOOTING_SLUG];

export const PROGRESS_KEY = 'cwol-guide-done';

export function parseDone(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= STEPS.length) : [];
  } catch {
    return [];
  }
}
