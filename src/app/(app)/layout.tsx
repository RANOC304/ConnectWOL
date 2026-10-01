import type { ReactNode } from 'react';
import { AppProvider } from '@/components/AppProvider';
import { AppShell } from '@/components/AppShell';
import { requireSession } from '@/server/auth/server-session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  return (
    <AppProvider csrfToken={session.csrfToken} username={session.username}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
