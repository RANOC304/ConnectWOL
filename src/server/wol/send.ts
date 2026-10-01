import dgram from 'node:dgram';
import type { PlannedAttempt, WakePlan } from './plan';

export interface AttemptResult {
  from?: string;
  to: string;
  /** True when at least one datagram was handed to the network stack for this destination. */
  ok: boolean;
  /** How many datagrams were accepted by the OS. */
  sent: number;
  error?: string;
}

export interface ExecuteOptions {
  /** Number of times every packet is sent (UDP is unreliable). */
  repeat: number;
  /** Pause between repeats, in milliseconds. */
  delayMs: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function describeError(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    return code && !err.message.includes(code) ? `${code}: ${err.message}` : err.message;
  }
  return String(err);
}

function sendOnce(socket: dgram.Socket, packet: Buffer, port: number, address: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.send(packet, port, address, (err) => (err ? reject(err) : resolve()));
  });
}

async function closeSocket(socket: dgram.Socket): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      socket.close(() => resolve());
    } catch {
      resolve(); // already closed
    }
  });
}

async function runGroup(
  family: 4 | 6,
  from: string | undefined,
  attempts: PlannedAttempt[],
  packet: Buffer,
  port: number,
  { repeat, delayMs }: ExecuteOptions,
): Promise<AttemptResult[]> {
  const results: AttemptResult[] = attempts.map((a) => ({ from, to: a.to, ok: false, sent: 0 }));
  const socket = dgram.createSocket({ type: family === 6 ? 'udp6' : 'udp4' });

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.bind({ port: 0, ...(from ? { address: from } : {}) }, () => {
        socket.removeListener('error', reject);
        resolve();
      });
    });
    if (family === 4) socket.setBroadcast(true);
  } catch (err) {
    await closeSocket(socket);
    const message = `Could not open a UDP socket${from ? ` on ${from}` : ''}: ${describeError(err)}`;
    return results.map((r) => ({ ...r, error: message }));
  }

  // Errors after bind are delivered through the send callbacks; this keeps stray ones from crashing the process.
  socket.on('error', () => undefined);

  for (let round = 0; round < repeat; round++) {
    if (round > 0) await sleep(delayMs);
    await Promise.all(
      results.map(async (r) => {
        try {
          await sendOnce(socket, packet, port, r.to);
          r.sent += 1;
          r.ok = true;
        } catch (err) {
          r.error = describeError(err);
        }
      }),
    );
  }

  await closeSocket(socket);
  return results;
}

/**
 * Sends `packet` to every destination of the plan, `repeat` times each. Destinations that share a
 * local interface share one socket. Never throws: failures are reported per destination.
 */
export async function executePlan(plan: WakePlan, packet: Buffer, options: ExecuteOptions): Promise<AttemptResult[]> {
  const groups = new Map<string, { family: 4 | 6; from?: string; attempts: PlannedAttempt[] }>();
  for (const attempt of plan.attempts) {
    const key = `${attempt.family}|${attempt.from ?? ''}`;
    const group = groups.get(key) ?? { family: attempt.family, from: attempt.from, attempts: [] };
    group.attempts.push(attempt);
    groups.set(key, group);
  }

  const settled = await Promise.all(
    [...groups.values()].map((g) => runGroup(g.family, g.from, g.attempts, packet, plan.port, options)),
  );
  return settled.flat();
}
