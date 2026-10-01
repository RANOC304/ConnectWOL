import { reorderSchema } from '@/lib/schemas';
import { badRequest, defineRoute } from '@/server/http';
import { listDevices, reorderDevices } from '@/server/services/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute({}, async ({ json }) => {
  const { ids } = await json(reorderSchema);
  if (!reorderDevices(ids)) throw badRequest('One or more devices no longer exist. Reload and try again.');
  return { devices: listDevices() };
});
