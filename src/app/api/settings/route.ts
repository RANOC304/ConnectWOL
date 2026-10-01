import { settingsPatchSchema } from '@/lib/schemas';
import { defineRoute } from '@/server/http';
import { getSettings, updateSettings } from '@/server/services/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({}, async () => ({ settings: getSettings() }));

export const PUT = defineRoute({}, async ({ json }) => {
  const patch = await json(settingsPatchSchema);
  return { settings: updateSettings(patch) };
});
