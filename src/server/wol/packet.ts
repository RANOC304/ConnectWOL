import { parseMac, parseSecureOn, InvalidMacError } from '@/lib/wol/mac';

/** Size of a plain magic packet: 6 bytes of 0xFF followed by the MAC repeated 16 times. */
export const MAGIC_PACKET_LENGTH = 6 + 16 * 6;

/**
 * Builds a Wake-on-LAN magic packet.
 *
 * Layout: `FF FF FF FF FF FF` + 16 × MAC (102 bytes), optionally followed by a 4 or 6 byte
 * SecureOn password. Both arguments accept any notation understood by the MAC parser.
 */
export function buildMagicPacket(mac: string, secureOn?: string | null): Buffer {
  const parsedMac = parseMac(mac);
  if (!parsedMac.ok) throw new InvalidMacError(parsedMac.error);

  let password: Uint8Array = new Uint8Array(0);
  if (secureOn !== undefined && secureOn !== null && secureOn.trim() !== '') {
    const parsedPassword = parseSecureOn(secureOn);
    if (!parsedPassword.ok) throw new InvalidMacError(parsedPassword.error);
    password = parsedPassword.bytes;
  }

  const packet = Buffer.alloc(MAGIC_PACKET_LENGTH + password.length, 0xff);
  for (let i = 0; i < 16; i++) {
    packet.set(parsedMac.bytes, 6 + i * 6);
  }
  packet.set(password, MAGIC_PACKET_LENGTH);
  return packet;
}
