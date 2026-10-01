import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the accessibility of the design tokens: parses src/styles/tokens.css and checks WCAG 2.x
 * contrast for the colour pairs the UI actually uses (text >= 4.5:1, UI boundaries/graphics >= 3:1).
 */
const css = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');

function tokens(pattern: RegExp): Record<string, string> {
  const body = css.match(pattern)?.[1] ?? '';
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]));
}

const light = tokens(/:root \{([\s\S]*?)\n\}/);
const dark = { ...light, ...tokens(/:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/) };
// the prefers-color-scheme block must define the same dark values as the explicit dark theme
const darkMedia = { ...light, ...tokens(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{([\s\S]*?)\n  \}/) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const GRAPHIC = 3;
const pairs: Array<[string, string, number]> = [
  ['ink', 'bg', TEXT],
  ['ink', 'surface', TEXT],
  ['ink-2', 'bg', TEXT],
  ['ink-2', 'surface', TEXT],
  ['muted', 'bg', TEXT],
  ['muted', 'surface', TEXT],
  ['muted', 'surface-2', TEXT],
  ['accent-text', 'bg', TEXT],
  ['accent-text', 'surface', TEXT],
  ['accent-text', 'accent-soft', TEXT],
  ['ok', 'ok-soft', TEXT],
  ['ok', 'surface', TEXT],
  ['warn', 'warn-soft', TEXT],
  ['danger', 'danger-soft', TEXT],
  ['danger', 'surface', TEXT],
  ['info', 'info-soft', TEXT],
  ['accent-ink', 'accent', TEXT],
  ['field-line', 'surface', GRAPHIC],
  ['field-line', 'bg', GRAPHIC],
  ['field-line', 'surface-2', GRAPHIC],
  ['focus', 'bg', GRAPHIC],
  ['focus', 'surface', GRAPHIC],
  ...['coral', 'amber', 'lime', 'teal', 'sky', 'indigo', 'violet', 'pink', 'slate'].map((c): [string, string, number] => ['tile-ink', `c-${c}`, GRAPHIC]),
];

describe.each([
  ['light theme', light],
  ['dark theme', dark],
  ['dark via prefers-color-scheme', darkMedia],
])('colour contrast: %s', (_name, theme) => {
  it.each(pairs)('%s on %s is at least %s:1', (fg, bg, min) => {
    expect(theme[fg], `token --${fg}`).toBeTruthy();
    expect(theme[bg], `token --${bg}`).toBeTruthy();
    expect(ratio(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(min);
  });
});

it('the explicit dark theme and the OS-preference dark theme define identical colours', () => {
  for (const key of Object.keys(dark)) expect(darkMedia[key], `--${key}`).toBe(dark[key]);
});
