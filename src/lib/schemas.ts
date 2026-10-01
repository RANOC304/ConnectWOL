import { z } from 'zod';
import { isHostOrIp, isIpv4 } from './hosts';
import { parseMac, parseSecureOn } from './wol/mac';

/* ---------- vocabularies shared with the UI ---------- */

export const DEVICE_ICONS = ['desktop', 'laptop', 'tower', 'server', 'nas', 'gamepad', 'tv', 'pi', 'router'] as const;
export const DEVICE_COLORS = ['coral', 'amber', 'lime', 'teal', 'sky', 'indigo', 'violet', 'pink', 'slate'] as const;
export const WAKE_MODES = ['local', 'remote'] as const;

export type DeviceIcon = (typeof DEVICE_ICONS)[number];
export type DeviceColor = (typeof DEVICE_COLORS)[number];
export type WakeModeValue = (typeof WAKE_MODES)[number];

export const LIMITS = {
  nameMax: 60,
  groupMax: 40,
  passwordMin: 10,
  passwordMax: 128,
  repeatMin: 1,
  repeatMax: 10,
  importMax: 5000,
  wakeBatchMax: 1000,
} as const;

/* ---------- field building blocks ---------- */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

const portField = z.coerce
  .number({ error: 'Port must be a number.' })
  .int('Port must be a whole number.')
  .min(1, 'Port must be between 1 and 65535.')
  .max(65535, 'Port must be between 1 and 65535.');

const nameField = z
  .string({ error: 'Name is required.' })
  .trim()
  .min(1, 'Name is required.')
  .max(LIMITS.nameMax, `Name must be at most ${LIMITS.nameMax} characters.`)
  .refine((v) => !CONTROL_CHARS.test(v), 'Name contains invalid characters.');

const macField = z.string({ error: 'MAC address is required.' }).transform((value, ctx) => {
  const result = parseMac(value);
  if (!result.ok) {
    ctx.addIssue({ code: 'custom', message: result.error });
    return z.NEVER;
  }
  return result.mac;
});

const targetField = z
  .string({ error: 'Address is required.' })
  .trim()
  .min(1, 'Address is required.')
  .refine(isHostOrIp, 'Enter an IP address (192.168.1.50) or a host name (desktop.lan).');

const broadcastField = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .refine(isIpv4, 'Broadcast address must be an IPv4 address such as 192.168.1.255.')
    .nullable(),
);

const secureOnField = z.preprocess(
  blankToNull,
  z
    .string()
    .transform((value, ctx) => {
      const result = parseSecureOn(value);
      if (!result.ok) {
        ctx.addIssue({ code: 'custom', message: result.error });
        return z.NEVER;
      }
      return result.password;
    })
    .nullable(),
);

const iconField = z.preprocess(blankToNull, z.enum(DEVICE_ICONS, { error: 'Unknown icon.' }).nullable());
const colorField = z.preprocess(blankToNull, z.enum(DEVICE_COLORS, { error: 'Unknown colour.' }).nullable());

const groupField = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(LIMITS.groupMax, `Group must be at most ${LIMITS.groupMax} characters.`)
    .refine((v) => !CONTROL_CHARS.test(v), 'Group contains invalid characters.')
    .nullable(),
);

const statusPortField = z.preprocess(blankToNull, portField.nullable());

/* ---------- devices ---------- */

/**
 * Create payload. Optional fields have no schema defaults on purpose: the service layer fills them
 * in (e.g. the default port comes from settings), and the same fields reused for PATCH must not
 * silently overwrite stored values.
 */
const deviceShape = {
  name: nameField,
  mac: macField,
  target: targetField,
  port: portField.optional(),
  wakeMode: z.enum(WAKE_MODES, { error: 'Mode must be "local" or "remote".' }).optional(),
  broadcast: broadcastField.optional(),
  secureOn: secureOnField.optional(),
  icon: iconField.optional(),
  color: colorField.optional(),
  groupName: groupField.optional(),
  statusPort: statusPortField.optional(),
};

export const deviceCreateSchema = z.object(deviceShape);
export const devicePatchSchema = z.object(deviceShape).partial();

export type DeviceCreateInput = z.output<typeof deviceCreateSchema>;
export type DevicePatchInput = z.output<typeof devicePatchSchema>;

const idList = z
  .array(z.number().int().positive())
  .min(1, 'Select at least one device.')
  .max(LIMITS.wakeBatchMax, `At most ${LIMITS.wakeBatchMax} devices per request.`)
  .refine((ids) => new Set(ids).size === ids.length, 'Device ids must be unique.');

export const reorderSchema = z.object({ ids: idList });

export const wakeRequestSchema = z.union([
  z.object({ ids: idList }),
  z.object({ group: z.string().trim().min(1, 'Group is required.').max(LIMITS.groupMax) }),
]);

export const statusRequestSchema = z.object({ ids: z.array(z.number().int().positive()).max(LIMITS.wakeBatchMax).optional() });

export const importSchema = z.object({
  app: z.string().optional(),
  version: z.number().optional(),
  mode: z.enum(['append', 'replace']).default('append'),
  devices: z.array(z.unknown()).max(LIMITS.importMax, `At most ${LIMITS.importMax} devices can be imported at once.`),
});

/* ---------- settings ---------- */

export const settingsPatchSchema = z
  .object({
    defaultPort: portField,
    repeatCount: z.coerce
      .number({ error: 'Repeat count must be a number.' })
      .int('Repeat count must be a whole number.')
      .min(LIMITS.repeatMin, `Repeat count must be between ${LIMITS.repeatMin} and ${LIMITS.repeatMax}.`)
      .max(LIMITS.repeatMax, `Repeat count must be between ${LIMITS.repeatMin} and ${LIMITS.repeatMax}.`),
  })
  .partial();

/* ---------- auth ---------- */

export const usernameField = z
  .string({ error: 'Username is required.' })
  .trim()
  .regex(/^[A-Za-z0-9._-]{3,32}$/, 'Username must be 3-32 characters: letters, digits, dot, dash or underscore.');

export const newPasswordField = z
  .string({ error: 'Password is required.' })
  .min(LIMITS.passwordMin, `Use at least ${LIMITS.passwordMin} characters.`)
  .max(LIMITS.passwordMax, `Use at most ${LIMITS.passwordMax} characters.`);

export const setupSchema = z.object({
  username: usernameField,
  password: newPasswordField,
  setupToken: z.string().max(256).optional(),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.').max(64),
  password: z.string().min(1, 'Password is required.').max(LIMITS.passwordMax),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(LIMITS.passwordMax),
  newPassword: newPasswordField,
});

/** Flattens a zod error into `{ field: firstMessage }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
