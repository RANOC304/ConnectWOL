import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import { isIpv4 } from '@/lib/hosts';

/** An IPv4 interface of the machine running ConnectWOL that can carry LAN broadcasts. */
export interface Ipv4Interface {
  name: string;
  address: string;
  netmask: string;
  broadcast: string;
}

export const LIMITED_BROADCAST = '255.255.255.255';

export function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new RangeError(`Not an IPv4 address: ${ip}`);
  }
  return (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0);
}

export function intToIpv4(value: number): string {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.');
}

/** Subnet-directed broadcast address of `address`/`netmask` (e.g. 192.168.1.20/24 -> 192.168.1.255). */
export function directedBroadcast(address: string, netmask: string): string {
  const addr = ipv4ToInt(address);
  const mask = ipv4ToInt(netmask);
  return intToIpv4(((addr & mask) | (~mask >>> 0)) >>> 0);
}

/** True when `ip` lies inside the subnet of `iface` (the broadcast address counts as inside). */
export function inSubnet(ip: string, iface: Pick<Ipv4Interface, 'address' | 'netmask'>): boolean {
  const mask = ipv4ToInt(iface.netmask);
  return ((ipv4ToInt(ip) & mask) >>> 0) === ((ipv4ToInt(iface.address) & mask) >>> 0);
}

/** Strict dotted-quad check (no leading zeros, which some stacks read as octal). */
export const isValidIpv4 = isIpv4;

type InterfaceSource = Record<string, NetworkInterfaceInfo[] | undefined>;

/**
 * Lists the non-loopback IPv4 interfaces that have a real broadcast domain. Point-to-point links
 * (/31, /32 - typical for VPN tunnels such as Tailscale) are skipped because they cannot broadcast.
 */
export function listIpv4Interfaces(source: InterfaceSource = networkInterfaces()): Ipv4Interface[] {
  const found: Ipv4Interface[] = [];
  for (const [name, infos] of Object.entries(source)) {
    for (const info of infos ?? []) {
      if (info.internal || info.family !== 'IPv4') continue;
      if (info.netmask === '255.255.255.255' || info.netmask === '255.255.255.254') continue;
      found.push({
        name,
        address: info.address,
        netmask: info.netmask,
        broadcast: directedBroadcast(info.address, info.netmask),
      });
    }
  }
  return found;
}
