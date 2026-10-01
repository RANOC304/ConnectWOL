'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useLocalStorage } from '@/lib/use-local-storage';
import { Icon } from '../Icons';
import { PROGRESS_KEY, STEPS, TROUBLESHOOTING_SLUG, parseDone } from './steps';

function useProgress() {
  const [raw, setRaw] = useLocalStorage(PROGRESS_KEY, null);
  const done = parseDone(raw);
  const setStep = (n: number, value: boolean) => {
    const next = value ? [...new Set([...done, n])].sort((a, b) => a - b) : done.filter((d) => d !== n);
    setRaw(JSON.stringify(next));
  };
  return { done, setStep };
}

/** /guide: the seven steps, with remembered progress. Any step can be reopened at any time. */
export function GuideIndex() {
  const { done } = useProgress();
  const next = STEPS.find((s) => !done.includes(s.n));
  const percent = Math.round((done.length / STEPS.length) * 100);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Setup guide</h1>
          <p>Seven short steps to make a computer wakeable, then reach it from anywhere.</p>
        </div>
      </header>

      <section className="guide-hero" aria-labelledby="guide-hero-title">
        <h2 id="guide-hero-title">{done.length === 0 ? 'Start at the beginning, or jump to what you need' : done.length === STEPS.length ? 'All steps done 🎉' : `${done.length} of ${STEPS.length} steps done`}</h2>
        <p>
          Wake-on-LAN depends on your hardware, firmware and network, so there’s no guarantee. These steps cover everything that usually matters, and the last stage tests it for real. You can leave and come back; your place is remembered in this browser.
        </p>
        <div className="guide-hero__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Guide progress">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="guide-hero__actions">
          {next ? (
            <Link className="btn btn--accent" href={`/guide/${next.n}`}>
              {done.length === 0 ? 'Start with step 1' : `Continue with step ${next.n}`}
              <Icon name="chevron-right" />
            </Link>
          ) : (
            <Link className="btn" href="/">
              Back to your computers
            </Link>
          )}
          <Link className="btn btn--ghost" href={`/guide/${TROUBLESHOOTING_SLUG}`}>
            <Icon name="alert" />
            Troubleshooting
          </Link>
        </div>
      </section>

      <ol className="step-list" aria-label="Steps">
        {STEPS.map((step) => {
          const isDone = done.includes(step.n);
          return (
            <li key={step.n}>
              <Link className="step-link" href={`/guide/${step.n}`} data-done={isDone}>
                <span className="step-link__num" aria-hidden="true">
                  {isDone ? <Icon name="check" strokeWidth={2.6} /> : step.n}
                </span>
                <span>
                  <span className="step-link__title">
                    {step.title}
                    {isDone && <span className="sr-only"> (done)</span>}
                  </span>
                  <br />
                  <span className="step-link__sum">
                    {step.summary} · about {step.minutes} min
                  </span>
                </span>
                <Icon name="chevron-right" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Frame around one step: title, stepper, content and previous/next navigation. */
export function StepFrame({ slug, children }: { slug: string; children: ReactNode }) {
  const router = useRouter();
  const { done, setStep } = useProgress();
  const isTroubleshooting = slug === TROUBLESHOOTING_SLUG;
  const n = isTroubleshooting ? 0 : Number(slug);
  const meta = STEPS.find((s) => s.n === n);
  const prev = STEPS.find((s) => s.n === n - 1);
  const nextStep = STEPS.find((s) => s.n === n + 1);
  const isDone = done.includes(n);

  function finish() {
    setStep(n, true);
    router.push(nextStep ? `/guide/${nextStep.n}` : '/');
  }

  return (
    <div className="page">
      <nav aria-label="Guide steps">
        <ol className="stepper">
          {STEPS.map((s) => (
            <li key={s.n}>
              <Link
                href={`/guide/${s.n}`}
                data-done={done.includes(s.n)}
                aria-current={s.n === n ? 'step' : undefined}
                aria-label={`Step ${s.n}: ${s.title}${done.includes(s.n) ? ' (done)' : ''}`}
                title={`${s.n}. ${s.title}`}
              />
            </li>
          ))}
        </ol>
      </nav>

      <header className="step-head">
        <span className="step-eyebrow">{isTroubleshooting ? 'Help' : `Step ${n} of ${STEPS.length}`}</span>
        <h1>{isTroubleshooting ? 'Troubleshooting' : meta?.title}</h1>
        <p>{isTroubleshooting ? 'When a packet is sent but the computer stays asleep.' : meta?.summary}</p>
      </header>

      {children}

      <div className="step-nav">
        <div className="step-nav__group">
          {isTroubleshooting ? (
            <Link className="btn btn--ghost" href="/guide">
              <Icon name="chevron-left" />
              All steps
            </Link>
          ) : prev ? (
            <Link className="btn btn--ghost" href={`/guide/${prev.n}`}>
              <Icon name="chevron-left" />
              Step {prev.n}
            </Link>
          ) : (
            <Link className="btn btn--ghost" href="/guide">
              <Icon name="chevron-left" />
              All steps
            </Link>
          )}
        </div>
        {!isTroubleshooting && (
          <div className="step-nav__group">
            {isDone ? (
              <button type="button" className="btn btn--ghost" onClick={() => setStep(n, false)}>
                <Icon name="check" />
                Done · undo
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setStep(n, true)}>
                Mark as done
              </button>
            )}
            {nextStep ? (
              <button type="button" className="btn" onClick={finish}>
                Next: {nextStep.title}
                <Icon name="chevron-right" />
              </button>
            ) : (
              <button type="button" className="btn btn--accent" onClick={finish}>
                Finish
                <Icon name="check" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
