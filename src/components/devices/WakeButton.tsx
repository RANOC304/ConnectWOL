'use client';

import { Icon } from '../Icons';

export type WakePhase = 'idle' | 'sending' | 'sent' | 'partial' | 'failed';

/**
 * The big round button. It is the one place the sunrise gradient is used at full strength:
 * ripples while packets go out, a drawn check when they were sent, a shake when they were not.
 */
export function WakeButton({ name, phase, onWake }: { name: string; phase: WakePhase; onWake: () => void }) {
  const label =
    phase === 'sending' ? `Waking ${name}…` : phase === 'sent' ? `Packets sent to ${name}` : phase === 'failed' ? `Could not send to ${name}. Try again` : `Wake ${name}`;
  return (
    <button type="button" className="wake" data-phase={phase} onClick={onWake} disabled={phase === 'sending'} aria-label={label} aria-busy={phase === 'sending'}>
      {phase === 'sent' ? <Icon name="check" className="wake__check" strokeWidth={2.6} /> : phase === 'failed' ? <Icon name="x" strokeWidth={2.6} /> : <Icon name="power" strokeWidth={2.4} />}
    </button>
  );
}
