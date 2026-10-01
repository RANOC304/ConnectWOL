import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { currentSession } from '@/server/auth/server-session';

export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await currentSession()) redirect('/');
  return <div className="auth">{children}</div>;
}
