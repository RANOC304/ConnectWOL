/**
 * MAC address (and SecureOn password) parsing.
 *
 * Pure and dependency-free so the exact same code validates input in the browser form and on the
 * server. Accepted notations for a 6-byte MAC:
 *
 *   AA:BB:CC:DD:EE:FF   AA-BB-CC-DD-EE-FF   AABB.CCDD.EEFF   AABBCCDDEEFF
 *
 * plus the "short group" form printed by macOS `arp -a` (0:1a:2b:3c:4d:5e). Case and surrounding
 * whitespace do not matter. A single address must use a single kind of separator, so strings such
 * as `AA:BB-CC:DD-EE:FF` are rejected as malformed rather than guessed at.
 */

export type OctetsResult =
  | { ok: true; bytes: Uint8Array; normalized: string }
  | { ok: false; error: string };

const HEX_ONLY = /^[0-9a-fA-F]+$/;
const ALLOWED = /^[0-9a-fA-F:.\-]+$/;
const SEPARATORS = [':', '-', '.'] as const;

function toNormalized(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
}

/**
 * Parses `input` into octets, accepting any of the notations above. `expected` lists the legal
 * octet counts (6 for a MAC, 4 or 6 for a SecureOn password).
 */
export function parseOctets(input: string, expected: readonly number[], label: string): OctetsResult {
  if (typeof input !== 'string') return { ok: false, error: `${label} must be text.` };
  const value = input.trim();
  if (value.length === 0) return { ok: false, error: `${label} is required.` };
  if (value.length > 32) return { ok: false, error: `${label} is too long.` };
  if (!ALLOWED.test(value)) {
    return {
      ok: false,
      error: `${label} may only contain hexadecimal digits (0-9, A-F) and the separators ":" "-" ".".`,
    };
  }

  const used = SEPARATORS.filter((s) => value.includes(s));
  if (used.length > 1) {
    return { ok: false, error: `${label} mixes separators (${used.map((s) => `"${s}"`).join(' and ')}); use only one kind.` };
  }

  const octetCountText = expected.map((n) => `${n}`).join(' or ');
  let octets: string[];

  if (used.length === 0) {
    if (!HEX_ONLY.test(value)) return { ok: false, error: `${label} is not valid hexadecimal.` };
    if (!expected.some((n) => value.length === n * 2)) {
      return {
        ok: false,
        error: `${label} must be ${expected.map((n) => n * 2).join(' or ')} hex digits long (${octetCountText} bytes); got ${value.length}.`,
      };
    }
    octets = value.match(/.{2}/g) ?? [];
  } else {
    const separator = used[0]!;
    const groups = value.split(separator);
    if (groups.some((g) => g.length === 0)) {
      return { ok: false, error: `${label} has an empty group (check for doubled or trailing "${separator}").` };
    }
    if (!groups.every((g) => HEX_ONLY.test(g))) {
      return { ok: false, error: `${label} is not valid hexadecimal.` };
    }
    const allFour = groups.every((g) => g.length === 4);
    const allShort = groups.every((g) => g.length >= 1 && g.length <= 2);
    if (allFour && expected.some((n) => groups.length * 2 === n)) {
      octets = groups.flatMap((g) => [g.slice(0, 2), g.slice(2)]);
    } else if (allShort && expected.includes(groups.length)) {
      octets = groups.map((g) => g.padStart(2, '0'));
    } else {
      return {
        ok: false,
        error: `${label} must have ${octetCountText} bytes (e.g. ${exampleFor(expected[0] ?? 6)}); check the number of groups.`,
      };
    }
  }

  const bytes = Uint8Array.from(octets, (o) => parseInt(o, 16));
  return { ok: true, bytes, normalized: toNormalized(bytes) };
}

function exampleFor(octets: number): string {
  return octets === 4 ? 'AA:BB:CC:DD' : 'AA:BB:CC:DD:EE:FF';
}

export type MacResult =
  | { ok: true; bytes: Uint8Array; mac: string }
  | { ok: false; error: string };

/** Parses a MAC address in any common notation and returns it as `AA:BB:CC:DD:EE:FF`. */
export function parseMac(input: string): MacResult {
  const parsed = parseOctets(input, [6], 'MAC address');
  if (!parsed.ok) return parsed;
  const { bytes, normalized } = parsed;
  if (bytes.every((b) => b === 0x00)) {
    return { ok: false, error: 'MAC address 00:00:00:00:00:00 is not a real network adapter.' };
  }
  if (bytes.every((b) => b === 0xff)) {
    return { ok: false, error: 'FF:FF:FF:FF:FF:FF is the broadcast address, not a computer. Enter the target adapter\'s own MAC.' };
  }
  return { ok: true, bytes, mac: normalized };
}

/** Like {@link parseMac} but throws on invalid input. */
export function normalizeMac(input: string): string {
  const result = parseMac(input);
  if (!result.ok) throw new InvalidMacError(result.error);
  return result.mac;
}

export class InvalidMacError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMacError';
  }
}

export type SecureOnResult =
  | { ok: true; bytes: Uint8Array; password: string }
  | { ok: false; error: string };

/** SecureOn passwords are 4 or 6 bytes, written like a MAC address. Returned as `AA:BB:CC:DD[:EE:FF]`. */
export function parseSecureOn(input: string): SecureOnResult {
  const parsed = parseOctets(input, [4, 6], 'SecureOn password');
  if (!parsed.ok) return parsed;
  return { ok: true, bytes: parsed.bytes, password: parsed.normalized };
}
