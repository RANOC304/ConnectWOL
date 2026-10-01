import { devicePatchSchema } from '@/lib/schemas';
import { defineRoute, notFound } from '@/server/http';
import { parseId } from '@/server/route-utils';
import { deleteDevice, getDevice, updateDevice } from '@/server/services/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

export const GET = defineRoute<Params>({}, async ({ params }) => {
  const device = getDevice(parseId(params.id));
  if (!device) throw notFound('Device not found.');
  return { device };
});

export const PATCH = defineRoute<Params>({}, async ({ params, json }) => {
  const id = parseId(params.id);
  const patch = await json(devicePatchSchema);
  const device = updateDevice(id, patch);
  if (!device) throw notFound('Device not found.');
  return { device };
});

export const DELETE = defineRoute<Params>({}, async ({ params }) => {
  if (!deleteDevice(parseId(params.id))) throw notFound('Device not found.');
  return { ok: true };
});
