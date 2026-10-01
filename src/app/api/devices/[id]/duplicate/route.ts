import { defineRoute, notFound } from '@/server/http';
import { parseId } from '@/server/route-utils';
import { duplicateDevice } from '@/server/services/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute<{ id: string }>({}, async ({ params }) => {
  const device = duplicateDevice(parseId(params.id));
  if (!device) throw notFound('Device not found.');
  return Response.json({ device }, { status: 201 });
});
