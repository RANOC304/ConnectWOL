import type { Metadata } from 'next';
import { SettingsView } from '@/components/settings/SettingsView';
import { getSettings } from '@/server/services/settings';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return <SettingsView settings={getSettings()} />;
}
