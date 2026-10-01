import { wakeRequestSchema } from '@/lib/schemas';
import { badRequest, defineRoute, notFound } from '@/server/http';
import { deviceRowsByIds, deviceRowsInGroup } from '@/server/services/devices';
import { wakeDevices } from '@/server/services/wake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Wakes several devices at once: every device of a group (`{group}`) or an explicit set (`{ids}`). */
export const POST = defineRoute(
  { limit: { name: 'wake-batch', limit: 12, windowMs: 60_000, by: 'session' } },
  async ({ json }) => {
    const input = await json(wakeRequestSchema);
    const rows = 'ids' in input ? deviceRowsByIds(input.ids) : deviceRowsInGroup(input.group);
    if (rows.length === 0) {
      if ('group' in input) throw notFound(`No devices in the group "${input.group}".`);
      throw badRequest('None of the selected devices exist.');
    }
    const results = await wakeDevices(rows);
    return { results };
  },
);
