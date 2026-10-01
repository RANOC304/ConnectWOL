/** Host/address validation shared by the browser form and the server (no Node-only imports). */

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);
const LABEL = /^[A-Za-z0-9_]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$/;

export function isIpv4(value: string): boolean {
  return IPV4.test(value);
}

export function isIpv6(value: string): boolean {
  if (value.length > 45 || !value.includes(':') || !/^[0-9a-fA-F:.]+$/.test(value)) return false;
  try {
    // The URL parser implements the full RFC 4291 text grammar, including "::" and embedded IPv4.
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

/** RFC 1123 host name (underscores tolerated because LAN names often contain them). */
export function isHostname(value: string): boolean {
  const name = value.endsWith('.') ? value.slice(0, -1) : value;
  if (name.length === 0 || name.length > 253) return false;
  const labels = name.split('.');
  if (!labels.every((l) => LABEL.test(l))) return false;
  // "999.1.1.1" or "1.2.3" are malformed IPv4 addresses, not host names.
  return !/^\d+$/.test(labels[labels.length - 1]!);
}

export function isHostOrIp(value: string): boolean {
  return isIpv4(value) || isIpv6(value) || isHostname(value);
}
