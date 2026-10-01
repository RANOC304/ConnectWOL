import type { Metadata } from 'next';
import { HistoryView } from '@/components/HistoryView';
import { listHistory } from '@/server/services/history';

export const metadata: Metadata = { title: 'History' };
export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  return <HistoryView initial={listHistory(50, 0)} />;
}
