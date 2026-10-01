import { describe, expect, it } from 'vitest';
import { InvalidMacError, normalizeMac, parseMac, parseSecureOn } from '@/lib/wol/mac';

describe('parseMac – accepted notations', () => {
  const canonical = 'AA:BB:CC:DD:EE:FF';
  const accepted: Array<[string, string]> = [
    ['colon upper', 'AA:BB:CC:DD:EE:FF'],
    ['colon lower', 'aa:bb:cc:dd:ee:ff'],
    ['colon mixed case', 'aA:Bb:cC:dD:eE:Ff'],
    ['dash', 'AA-BB-CC-DD-EE-FF'],
    ['dash lower', 'aa-bb-cc-dd-ee-ff'],
    ['Cisco dotted', 'AABB.CCDD.EEFF'],
    ['Cisco dotted lower', 'aabb.ccdd.eeff'],
    ['dotted octets', 'aa.bb.cc.dd.ee.ff'],
    ['plain hex', 'AABBCCDDEEFF'],
    ['plain hex lower', 'aabbccddeeff'],
    ['surrounding whitespace', '  aa:bb:cc:dd:ee:ff \n'],
    ['dash groups of four', 'AABB-CCDD-EEFF'],
  ];

  it.each(accepted)('%s', (_label, input) => {
    const result = parseMac(input);
    expect(result).toMatchObject({ ok: true, mac: canonical });
    if (result.ok) expect(Array.from(result.bytes)).toEqual([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
  });

  it('pads short groups as printed by macOS arp (0:1a:2b:3c:4d:5e)', () => {
    expect(parseMac('0:1a:2b:3c:4d:5e')).toMatchObject({ ok: true, mac: '00:1A:2B:3C:4D:5E' });
    expect(parseMac('0-1-2-3-4-5')).toMatchObject({ ok: true, mac: '00:01:02:03:04:05' });
  });

  it('keeps leading zeros', () => {
    expect(parseMac('00:11:22:03:04:05')).toMatchObject({ ok: true, mac: '00:11:22:03:04:05' });
    expect(parseMac('001122030405')).toMatchObject({ ok: true, mac: '00:11:22:03:04:05' });
  });
});

describe('parseMac – rejected input', () => {
  const rejected: Array<[string, string, RegExp]> = [
    ['empty', '', /required/i],
    ['whitespace only', '   ', /required/i],
    ['too few groups', 'AA:BB:CC:DD:EE', /groups|bytes/i],
    ['too many groups', 'AA:BB:CC:DD:EE:FF:00', /groups|bytes/i],
    ['non-hex letter', 'AA:BB:CC:DD:EE:GG', /hexadecimal/i],
    ['0x prefix', '0xAA:BB:CC:DD:EE:FF', /hexadecimal/i],
    ['spaces inside', 'AA BB CC DD EE FF', /hexadecimal/i],
    ['unicode digits', 'AA:BB:CC:DD:EE:F٣', /hexadecimal/i],
    ['emoji', '🙂', /hexadecimal/i],
    ['11 hex digits', 'AABBCCDDEEF', /hex digits/i],
    ['13 hex digits', 'AABBCCDDEEFF0', /hex digits/i],
    ['14 hex digits', 'AABBCCDDEEFF00', /hex digits/i],
    ['mixed colon and dash', 'AA:BB-CC:DD-EE:FF', /mixes separators/i],
    ['mixed colon and dot', 'AA:BB:CC.DD:EE:FF', /mixes separators/i],
    ['all three separators', 'AA:BB-CC.DD:EE:FF', /mixes separators/i],
    ['doubled separator', 'AA::BB:CC:DD:EE', /empty group/i],
    ['leading separator', ':AA:BB:CC:DD:EE:FF', /empty group/i],
    ['trailing separator', 'AA:BB:CC:DD:EE:FF:', /empty group/i],
    ['three-digit group', 'AAA:BB:CC:DD:EE:FF', /groups|bytes/i],
    ['wrong dotted group size', 'AAB.BCC.DDE.EFF', /groups|bytes/i],
    ['dotted wrong count', 'AABB.CCDD', /groups|bytes/i],
    ['all zero', '00:00:00:00:00:00', /not a real/i],
    ['all zero plain', '000000000000', /not a real/i],
    ['broadcast', 'FF:FF:FF:FF:FF:FF', /broadcast/i],
    ['too long', 'AA:'.repeat(20) + 'AA', /too long/i],
  ];

  it.each(rejected)('%s', (_label, input, message) => {
    const result = parseMac(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it('does not throw on non-string input', () => {
    // @ts-expect-error deliberately wrong type, e.g. JSON from a hostile client
    expect(parseMac(undefined)).toMatchObject({ ok: false });
    // @ts-expect-error deliberately wrong type
    expect(parseMac(1234)).toMatchObject({ ok: false });
    // @ts-expect-error deliberately wrong type
    expect(parseMac({ mac: 'AA:BB:CC:DD:EE:FF' })).toMatchObject({ ok: false });
  });
});

describe('normalizeMac', () => {
  it('returns the canonical form', () => {
    expect(normalizeMac('aabb.ccdd.eeff')).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('throws InvalidMacError with a readable message', () => {
    expect(() => normalizeMac('nope')).toThrow(InvalidMacError);
    expect(() => normalizeMac('nope')).toThrow(/hexadecimal/i);
  });
});

describe('parseSecureOn', () => {
  it('accepts 6-byte passwords in every notation', () => {
    for (const input of ['11:22:33:44:55:66', '11-22-33-44-55-66', '1122.3344.5566', '112233445566']) {
      expect(parseSecureOn(input)).toMatchObject({ ok: true, password: '11:22:33:44:55:66' });
    }
  });

  it('accepts 4-byte passwords', () => {
    for (const input of ['11:22:33:44', '11223344', '1122.3344']) {
      const result = parseSecureOn(input);
      expect(result).toMatchObject({ ok: true, password: '11:22:33:44' });
      if (result.ok) expect(result.bytes.length).toBe(4);
    }
  });

  it('allows an all-zero or all-FF password (they are just bytes here)', () => {
    expect(parseSecureOn('00:00:00:00')).toMatchObject({ ok: true });
    expect(parseSecureOn('FF:FF:FF:FF:FF:FF')).toMatchObject({ ok: true });
  });

  it('rejects wrong lengths and bad characters', () => {
    for (const input of ['', '11:22:33', '11:22:33:44:55', '11:22:33:44:55:66:77', 'zz:11:22:33', '11:22-33:44']) {
      expect(parseSecureOn(input).ok).toBe(false);
    }
  });
});
