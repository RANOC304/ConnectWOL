import { deviceCreateSchema } from '@/lib/schemas';
import { defineRoute } from '@/server/http';
import { createDevice, listDevices } from '@/server/services/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({}, async () => ({ devices: listDevices() }));

export const POST = defineRoute({}, async ({ json }) => {
  const input = await json(deviceCreateSchema);
  return Response.json({ device: createDevice(input) }, { status: 201 });
});
