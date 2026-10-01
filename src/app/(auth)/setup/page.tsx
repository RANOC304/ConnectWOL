import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SetupForm } from '@/components/auth/SetupForm';
import { setupRequired } from '@/server/auth/users';
import { getConfig } from '@/server/config';

export const metadata: Metadata = { title: 'Welcome' };
export const dynamic = 'force-dynamic';

export default function SetupPage() {
  if (!setupRequired()) redirect('/login');
  return <SetupForm needsToken={getConfig().setupToken !== null} />;
}
