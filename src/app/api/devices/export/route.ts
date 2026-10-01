import { defineRoute } from '@/server/http';
import { exportDevices } from '@/server/services/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Downloads every device as a JSON backup (includes SecureOn passwords - keep the file private). */
export const GET = defineRoute({}, async () => {
  const body = exportDevices();
  const day = body.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="connectwol-devices-${day}.json"`,
    },
  });
});
