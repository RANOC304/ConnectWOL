import { defineRoute, notFound } from '@/server/http';
import { parseId } from '@/server/route-utils';
import { getDeviceRow } from '@/server/services/devices';
import { wakeDevices } from '@/server/services/wake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sends the magic packet(s). The response only says whether packets were handed to the network;
 * nothing here can know whether the computer actually woke up.
 */
export const POST = defineRoute<{ id: string }>(
  { limit: { name: 'wake', limit: 60, windowMs: 60_000, by: 'session' } },
  async ({ params }) => {
    const row = getDeviceRow(parseId(params.id));
    if (!row) throw notFound('Device not found.');
    const [result] = await wakeDevices([row]);
    return { result };
  },
);
