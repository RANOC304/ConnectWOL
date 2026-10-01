import type { Metadata } from 'next';
import { DevicesView } from '@/components/devices/DevicesView';
import { listDevices } from '@/server/services/devices';
import { getSettings } from '@/server/services/settings';

export const metadata: Metadata = { title: 'Devices' };
export const dynamic = 'force-dynamic';

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  return <DevicesView initialDevices={listDevices()} settings={getSettings()} openAddOnLoad={add === '1'} />;
}
