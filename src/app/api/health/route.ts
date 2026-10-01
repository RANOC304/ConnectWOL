import { APP_NAME } from '@/lib/brand';
import { getDb } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Unauthenticated liveness probe (used by the Docker health check). Reveals nothing but "up". */
export async function GET() {
  try {
    getDb().$client.prepare('select 1').get();
    return Response.json({ ok: true, app: APP_NAME }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
