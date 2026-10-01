import net from 'node:net';

export type PresenceState = 'online' | 'offline' | 'unknown';

export interface PresenceResult {
  state: PresenceState;
  /** Short explanation shown in the UI. This is a best-effort heuristic, not a guarantee. */
  detail: string;
  latencyMs?: number;
  /**
   * For `online`: how we know. `connected` = the port accepted the connection; `refused` = the host
   * answered with a reset, so it is up but nothing listens on that port.
   */
  via?: 'connected' | 'refused';
}

/**
 * Best-effort "is it up?" check: tries to open a TCP connection to `host:port` from the server.
 *
 *  - connection accepted      -> online
 *  - connection refused (RST) -> online: the machine answered, only that port is closed
 *  - timeout / unreachable    -> offline (asleep, off, firewalled, or a different network)
 *  - anything else (DNS...)   -> unknown
 *
 * A firewall that silently drops packets looks identical to a powered-off machine, which is why the
 * UI labels the result "best effort".
 */
export function probeTcp(host: string, port: number, timeoutMs = 1500): Promise<PresenceResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let finished = false;

    const finish = (result: PresenceResult) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () =>
      finish({ state: 'online', via: 'connected', detail: `Port ${port} accepted a connection.`, latencyMs: Date.now() - started }),
    );
    socket.once('timeout', () => finish({ state: 'offline', detail: `No answer from port ${port} within ${timeoutMs} ms.` }));
    socket.once('error', (err: NodeJS.ErrnoException) => {
      switch (err.code) {
        case 'ECONNREFUSED':
          finish({
            state: 'online',
            via: 'refused',
            detail: `The computer answered, but nothing is listening on port ${port}.`,
            latencyMs: Date.now() - started,
          });
          break;
        case 'EHOSTUNREACH':
        case 'ENETUNREACH':
        case 'ETIMEDOUT':
        case 'EHOSTDOWN':
          finish({ state: 'offline', detail: 'The host could not be reached.' });
          break;
        case 'ENOTFOUND':
        case 'EAI_AGAIN':
          finish({ state: 'unknown', detail: 'The host name could not be resolved.' });
          break;
        default:
          finish({ state: 'unknown', detail: err.message });
      }
    });

    try {
      socket.connect({ host, port });
    } catch (err) {
      finish({ state: 'unknown', detail: err instanceof Error ? err.message : 'Invalid address.' });
    }
  });
}
