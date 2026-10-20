'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { Button } from './button';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Modal panel. Bottom sheet on mobile, right-side drawer from md up.
 * Escape and backdrop click close it; focus is trapped and restored; body scroll is locked.
 */
export function Sheet({ open, onClose, title, footer, children, className }: SheetProps) {
  if (!open) return null;
  return (
    <SheetPanel onClose={onClose} title={title} footer={footer} className={className}>
      {children}
    </SheetPanel>
  );
}

function SheetPanel({
  onClose,
  title,
  footer,
  className,
  children,
}: Omit<SheetProps, 'open'>) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    setMounted(true);
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);

  // The panel is portalled after mount, so move focus into it once it exists.
  useEffect(() => {
    if (mounted) panelRef.current?.focus();
  }, [mounted]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:justify-end">
      <div aria-hidden="true" onClick={() => onClose()} className="absolute inset-0 bg-scrim" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[85dvh] w-full flex-col bg-surface text-ink shadow-card outline-none',
          'rounded-t-card md:h-full md:max-h-none md:w-[min(28rem,100vw)] md:rounded-none md:border-l md:border-line',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={() => onClose()}>
            <span aria-hidden="true" className="text-lg leading-none">
              &times;
            </span>
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
