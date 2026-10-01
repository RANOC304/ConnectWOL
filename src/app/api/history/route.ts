import { z } from 'zod';
import { badRequest, defineRoute } from '@/server/http';
import { clearHistory, listHistory } from '@/server/services/history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const query = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GET = defineRoute({}, async ({ url }) => {
  const parsed = query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) throw badRequest('limit must be 1-200 and offset 0 or more.');
  return listHistory(parsed.data.limit, parsed.data.offset);
});

export const DELETE = defineRoute({}, async () => ({ cleared: clearHistory() }));
