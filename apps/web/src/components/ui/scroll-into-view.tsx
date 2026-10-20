'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Keeps a freshly shown form result (Saved / error) visible when the submit button was far below it. */
export function ScrollIntoView({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  return <div ref={ref}>{children}</div>;
}
