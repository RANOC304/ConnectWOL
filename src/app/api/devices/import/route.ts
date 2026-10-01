import { deviceCreateSchema, fieldErrors, importSchema, type DeviceCreateInput } from '@/lib/schemas';
import { ApiError, defineRoute, IMPORT_BODY_LIMIT } from '@/server/http';
import { importDevices, listDevices } from '@/server/services/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REPORTED_ERRORS = 20;

/**
 * Restores a JSON backup. All-or-nothing: if any entry is invalid, nothing is imported and the
 * first problems are reported per entry (`devices.3.mac`).
 */
export const POST = defineRoute({ bodyLimit: IMPORT_BODY_LIMIT }, async ({ rawJson }) => {
  const body = await rawJson();
  const envelope = importSchema.safeParse(body);
  if (!envelope.success) {
    throw new ApiError(400, 'validation_error', 'This does not look like a ConnectWOL device export.', fieldErrors(envelope.error));
  }

  const valid: DeviceCreateInput[] = [];
  const problems: Record<string, string> = {};
  let invalid = 0;
  envelope.data.devices.forEach((entry, index) => {
    const parsed = deviceCreateSchema.safeParse(entry);
    if (parsed.success) {
      valid.push(parsed.data);
      return;
    }
    invalid += 1;
    for (const [field, message] of Object.entries(fieldErrors(parsed.error))) {
      if (Object.keys(problems).length < MAX_REPORTED_ERRORS) problems[`devices.${index}.${field}`] = message;
    }
  });

  if (invalid > 0) {
    throw new ApiError(
      400,
      'validation_error',
      `${invalid} of ${envelope.data.devices.length} entries are invalid, so nothing was imported.`,
      problems,
    );
  }

  const summary = importDevices(valid, envelope.data.mode);
  return { ...summary, devices: listDevices() };
});
