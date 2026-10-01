'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icons';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal built on the native <dialog>: focus is trapped, Escape closes it, the page behind is inert,
 * and screen readers announce it as a dialog. Presented as a bottom sheet on phones.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first focusable element (the close button). Forms mark the field
      // that should receive focus instead; React's autoFocus cannot do this inside a closed <dialog>.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // a click on the backdrop is dispatched on the <dialog> element itself
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <>
          <div className="sheet__grab" aria-hidden="true" />
          <div className="sheet__head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
          <div className="sheet__body">{children}</div>
          {footer && <div className="sheet__foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
