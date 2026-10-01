import { statusRequestSchema } from '@/lib/schemas';
import { defineRoute } from '@/server/http';
import { deviceRowsByIds, listDeviceRows } from '@/server/services/devices';
import { checkPresence } from '@/server/services/wake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Best-effort presence check: the server tries a TCP connection to each device's status port.
 * Without `ids`, every device that has a status port is checked. Devices without one are omitted.
 */
export const POST = defineRoute(
  { limit: { name: 'status', limit: 120, windowMs: 60_000, by: 'session' } },
  async ({ json }) => {
    const { ids } = await json(statusRequestSchema);
    const rows = ids ? deviceRowsByIds(ids) : listDeviceRows();
    return { statuses: await checkPresence(rows) };
  },
);
