import { changePasswordSchema } from '@/lib/schemas';
import { destroyOtherSessions } from '@/server/auth/sessions';
import { changePassword } from '@/server/auth/users';
import { ApiError, defineRoute } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute(
  { limit: { name: 'password', limit: 5, windowMs: 15 * 60_000, by: 'session' } },
  async ({ session, json }) => {
    const { currentPassword, newPassword } = await json(changePasswordSchema);
    if (currentPassword === newPassword) {
      throw new ApiError(400, 'validation_error', 'Please check the highlighted fields.', {
        newPassword: 'Choose a password different from the current one.',
      });
    }
    // Reported as a field error (400), not 401, so the UI does not mistake it for a lost session.
    const ok = await changePassword(session!.userId, currentPassword, newPassword);
    if (!ok) {
      throw new ApiError(400, 'validation_error', 'Please check the highlighted fields.', {
        currentPassword: 'That is not your current password.',
      });
    }
    destroyOtherSessions(session!.userId, session!.id);
    return { ok: true };
  },
);
