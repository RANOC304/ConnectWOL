import { isIP } from 'node:net';
import { LIMITED_BROADCAST, inSubnet, isValidIpv4, type Ipv4Interface } from './network';

export type WakeMode = 'local' | 'remote';

export interface PlanInput {
  mode: WakeMode;
  /** IP address or hostname of the computer (or the DDNS name of its network in remote mode). */
  target: string;
  port: number;
  /** Optional subnet-directed broadcast address override (local mode only). */
  broadcast?: string | null;
}

/** One place a packet is sent. `from` pins the socket to a local interface address. */
export interface PlannedAttempt {
  from?: string;
  to: string;
  family: 4 | 6;
}

export interface WakePlan {
  mode: WakeMode;
  port: number;
  attempts: PlannedAttempt[];
  /** Human-readable remarks about how the destinations were chosen. */
  notes: string[];
}

export interface PlanDeps {
  interfaces: Ipv4Interface[];
  /** Resolves a hostname to addresses of the given family (all families when omitted). */
  lookup: (host: string, family?: 4 | 6) => Promise<string[]>;
}

/** The target could not be turned into a destination (for example a hostname that does not resolve). */
export class WakePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WakePlanError';
  }
}

function dedupe(attempts: PlannedAttempt[]): PlannedAttempt[] {
  const seen = new Set<string>();
  return attempts.filter((a) => {
    const key = `${a.family}|${a.from ?? ''}|${a.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function viaInterface(iface: Ipv4Interface): PlannedAttempt[] {
  return [
    { from: iface.address, to: iface.broadcast, family: 4 },
    { from: iface.address, to: LIMITED_BROADCAST, family: 4 },
  ];
}

async function resolveIpv4(target: string, deps: PlanDeps): Promise<string | undefined> {
  if (isValidIpv4(target)) return target;
  if (isIP(target) !== 0) return undefined; // IPv6 literal: cannot be matched to an IPv4 subnet
  try {
    return (await deps.lookup(target, 4))[0];
  } catch {
    return undefined;
  }
}

/**
 * Decides where a magic packet should be sent.
 *
 * Local mode broadcasts on the LAN. The directed broadcast address comes from (in order): the
 * device's explicit override, the local subnet containing the target, or - when the target cannot
 * be placed - every interface of this machine. The limited broadcast 255.255.255.255 is always
 * added too, because some adapters/routers only honour one of the two. Each packet is bound to the
 * interface it belongs to so a multi-homed host sends it out of the right network card.
 *
 * Remote mode resolves the host name (DDNS names are fine) and sends one unicast datagram.
 */
export async function planWake(input: PlanInput, deps: PlanDeps): Promise<WakePlan> {
  const notes: string[] = [];

  if (input.mode === 'remote') {
    let address = input.target;
    if (isIP(address) === 0) {
      const v4 = await deps.lookup(address, 4).catch(() => [] as string[]);
      const candidates = v4.length > 0 ? v4 : await deps.lookup(address, 6).catch(() => [] as string[]);
      const first = candidates[0];
      if (!first) throw new WakePlanError(`Could not resolve "${input.target}". Check the host name or DDNS record.`);
      address = first;
      notes.push(`Resolved ${input.target} to ${address}.`);
    }
    const family = isIP(address) === 6 ? 6 : 4;
    return { mode: 'remote', port: input.port, attempts: [{ to: address, family }], notes };
  }

  const { interfaces } = deps;
  const attempts: PlannedAttempt[] = [];
  const explicit = input.broadcast?.trim() || undefined;
  if (explicit && !isValidIpv4(explicit)) {
    throw new WakePlanError(`"${explicit}" is not a valid IPv4 broadcast address.`);
  }

  if (explicit) {
    const iface = interfaces.find((i) => i.broadcast === explicit) ?? interfaces.find((i) => inSubnet(explicit, i));
    if (iface) {
      attempts.push({ from: iface.address, to: explicit, family: 4 }, { from: iface.address, to: LIMITED_BROADCAST, family: 4 });
    } else {
      attempts.push({ to: explicit, family: 4 }, { to: LIMITED_BROADCAST, family: 4 });
      notes.push(`${explicit} is not on any of this host's networks; sent without binding to an interface.`);
    }
    return { mode: 'local', port: input.port, attempts: dedupe(attempts), notes };
  }

  const targetIp = await resolveIpv4(input.target, deps);
  const owner = targetIp ? interfaces.find((i) => inSubnet(targetIp, i)) : undefined;

  if (owner) {
    attempts.push(...viaInterface(owner));
  } else if (interfaces.length > 0) {
    for (const iface of interfaces) attempts.push(...viaInterface(iface));
    notes.push(
      targetIp
        ? `${targetIp} is not on a network this host is attached to; broadcast on every interface instead.`
        : 'Could not place the target in a local network; broadcast on every interface instead.',
    );
  } else {
    attempts.push({ to: LIMITED_BROADCAST, family: 4 });
    notes.push('No usable network interface was found; only the limited broadcast address was used.');
  }

  return { mode: 'local', port: input.port, attempts: dedupe(attempts), notes };
}
