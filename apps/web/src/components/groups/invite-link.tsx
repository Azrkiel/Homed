'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui';

/**
 * Invite link with a copy button. If the clipboard is unavailable or blocked, the read-only field is
 * selected so the user can copy it by hand.
 */
export function InviteLink({ url }: { url: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setStatus('Copied');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setStatus('Copy is blocked here. The link is selected; press Ctrl+C to copy it.');
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="invite-url" className="sr-only">
          Invite link
        </label>
        <input
          ref={inputRef}
          id="invite-url"
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full min-w-0 flex-1 rounded-sm border border-line bg-surface px-3 font-mono text-sm text-ink"
        />
        <Button variant="secondary" onClick={copy} className="shrink-0">
          Copy link
        </Button>
      </div>
      <p role="status" aria-live="polite" className={status ? 'text-sm text-ink-2' : 'sr-only'}>
        {status}
      </p>
    </div>
  );
}
