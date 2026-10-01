import dns from 'node:dns/promises';
import { InvalidMacError } from '@/lib/wol/mac';
import { listIpv4Interfaces } from './network';
import { buildMagicPacket } from './packet';
import { planWake, WakePlanError, type PlanDeps, type WakeMode } from './plan';
import { executePlan, type AttemptResult } from './send';

export interface WakeDevice {
  mac: string;
  target: string;
  port: number;
  wakeMode: WakeMode;
  broadcast?: string | null;
  secureOn?: string | null;
}

export interface WakeOptions {
  repeat: number;
  delayMs: number;
}

export type WakeResult = 'sent' | 'partial' | 'failed';

export interface WakeOutcome {
  result: WakeResult;
  /** `host:port` strings that were attempted, for display and the history log. */
  destinations: string[];
  attempts: AttemptResult[];
  packetBytes: number;
  repeat: number;
  /** One-line, honest description. It never claims that the computer woke up. */
  detail: string;
  notes: string[];
}

async function lookupHost(host: string, family?: 4 | 6): Promise<string[]> {
  const records = await dns.lookup(host, { all: true, ...(family ? { family } : {}) });
  return records.map((r) => r.address);
}

export const defaultPlanDeps = (): PlanDeps => ({ interfaces: listIpv4Interfaces(), lookup: lookupHost });

function failed(detail: string, repeat: number, packetBytes = 0): WakeOutcome {
  return { result: 'failed', destinations: [], attempts: [], packetBytes, repeat, detail, notes: [] };
}

/**
 * Builds the magic packet for `device`, works out where to send it and sends it `repeat` times.
 * Resolves with an outcome in every case (bad MAC, unresolvable host, socket errors...) so callers
 * can log it; it only rejects on programmer error.
 */
export async function wakeDevice(
  device: WakeDevice,
  options: WakeOptions,
  deps: PlanDeps = defaultPlanDeps(),
): Promise<WakeOutcome> {
  let packet: Buffer;
  try {
    packet = buildMagicPacket(device.mac, device.secureOn);
  } catch (err) {
    if (err instanceof InvalidMacError) return failed(err.message, options.repeat);
    throw err;
  }

  let plan;
  try {
    plan = await planWake(
      { mode: device.wakeMode, target: device.target, port: device.port, broadcast: device.broadcast },
      deps,
    );
  } catch (err) {
    if (err instanceof WakePlanError) return failed(err.message, options.repeat, packet.length);
    throw err;
  }

  const attempts = await executePlan(plan, packet, options);
  const okCount = attempts.filter((a) => a.ok).length;
  const destinations = [...new Set(attempts.map((a) => `${a.to}:${plan.port}`))];
  const result: WakeResult = okCount === attempts.length ? 'sent' : okCount > 0 ? 'partial' : 'failed';

  const errors = [...new Set(attempts.filter((a) => a.error).map((a) => a.error as string))];
  let detail: string;
  if (result === 'sent') {
    detail = `Sent ${options.repeat}× to ${destinations.join(', ')}.`;
  } else if (result === 'partial') {
    detail = `Sent to ${okCount} of ${attempts.length} destinations. ${errors.join(' ')}`.trim();
  } else {
    detail = errors.length > 0 ? errors.join(' ') : 'The packet could not be sent.';
  }

  return { result, destinations, attempts, packetBytes: packet.length, repeat: options.repeat, detail, notes: plan.notes };
}
