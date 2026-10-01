import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StepFrame } from '@/components/guide/GuideProgress';
import { Step1, Step2, Step3, Step4 } from '@/components/guide/StepsPart1';
import { Step5, Step6, Step7, Troubleshooting } from '@/components/guide/StepsPart2';
import { STEP_SLUGS, STEPS, TROUBLESHOOTING_SLUG } from '@/components/guide/steps';

const CONTENT: Record<string, () => React.JSX.Element> = {
  '1': Step1,
  '2': Step2,
  '3': Step3,
  '4': Step4,
  '5': Step5,
  '6': Step6,
  '7': Step7,
  [TROUBLESHOOTING_SLUG]: Troubleshooting,
};

type Props = { params: Promise<{ step: string }> };

export function generateStaticParams() {
  return STEP_SLUGS.map((step) => ({ step }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { step } = await params;
  if (step === TROUBLESHOOTING_SLUG) return { title: 'Troubleshooting' };
  const meta = STEPS.find((s) => String(s.n) === step);
  return { title: meta ? `Step ${meta.n}: ${meta.title}` : 'Setup guide' };
}

export default async function GuideStepPage({ params }: Props) {
  const { step } = await params;
  const Content = CONTENT[step];
  if (!Content || !STEP_SLUGS.includes(step)) notFound();
  return (
    <StepFrame slug={step}>
      <Content />
    </StepFrame>
  );
}
