import { describe, expect, it } from 'vitest';
import { InvalidMacError } from '@/lib/wol/mac';
import { buildMagicPacket, MAGIC_PACKET_LENGTH } from '@/server/wol/packet';

const MAC_BYTES = [0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e];

describe('buildMagicPacket', () => {
  it('is 102 bytes: 6×FF then the MAC 16 times', () => {
    const packet = buildMagicPacket('00:1A:2B:3C:4D:5E');
    expect(packet.length).toBe(102);
    expect(MAGIC_PACKET_LENGTH).toBe(102);
    expect(Array.from(packet.subarray(0, 6))).toEqual([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    for (let i = 0; i < 16; i++) {
      expect(Array.from(packet.subarray(6 + i * 6, 12 + i * 6))).toEqual(MAC_BYTES);
    }
  });

  it('is identical for every MAC notation', () => {
    const reference = buildMagicPacket('00:1A:2B:3C:4D:5E');
    for (const input of ['00-1a-2b-3c-4d-5e', '001a.2b3c.4d5e', '001A2B3C4D5E', '0:1a:2b:3c:4d:5e']) {
      expect(buildMagicPacket(input).equals(reference)).toBe(true);
    }
  });

  it('appends a 6-byte SecureOn password (108 bytes)', () => {
    const packet = buildMagicPacket('00:1A:2B:3C:4D:5E', '11:22:33:44:55:66');
    expect(packet.length).toBe(108);
    expect(Array.from(packet.subarray(102))).toEqual([0x11, 0x22, 0x33, 0x44, 0x55, 0x66]);
    // the first 102 bytes are unchanged
    expect(packet.subarray(0, 102).equals(buildMagicPacket('00:1A:2B:3C:4D:5E'))).toBe(true);
  });

  it('appends a 4-byte SecureOn password (106 bytes)', () => {
    const packet = buildMagicPacket('00:1A:2B:3C:4D:5E', '0a0b0c0d');
    expect(packet.length).toBe(106);
    expect(Array.from(packet.subarray(102))).toEqual([0x0a, 0x0b, 0x0c, 0x0d]);
  });

  it('treats null, undefined and blank passwords as "no password"', () => {
    for (const none of [undefined, null, '', '   ']) {
      expect(buildMagicPacket('00:1A:2B:3C:4D:5E', none).length).toBe(102);
    }
  });

  it('throws InvalidMacError for a bad MAC', () => {
    expect(() => buildMagicPacket('00:1A:2B:3C:4D')).toThrow(InvalidMacError);
    expect(() => buildMagicPacket('')).toThrow(InvalidMacError);
    expect(() => buildMagicPacket('ZZ:1A:2B:3C:4D:5E')).toThrow(InvalidMacError);
    expect(() => buildMagicPacket('00:00:00:00:00:00')).toThrow(InvalidMacError);
  });

  it('throws InvalidMacError for a bad SecureOn password', () => {
    expect(() => buildMagicPacket('00:1A:2B:3C:4D:5E', '11:22:33')).toThrow(InvalidMacError);
    expect(() => buildMagicPacket('00:1A:2B:3C:4D:5E', 'not-hex')).toThrow(InvalidMacError);
  });

  it('returns a fresh buffer each call (no shared mutable state)', () => {
    const a = buildMagicPacket('00:1A:2B:3C:4D:5E');
    const b = buildMagicPacket('00:1A:2B:3C:4D:5E');
    a[0] = 0;
    expect(b[0]).toBe(0xff);
  });
});
