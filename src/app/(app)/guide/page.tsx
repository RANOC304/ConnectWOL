import type { Metadata } from 'next';
import { GuideIndex } from '@/components/guide/GuideProgress';

export const metadata: Metadata = { title: 'Setup guide' };

export default function GuidePage() {
  return <GuideIndex />;
}
