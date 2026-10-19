'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { WEIGHT_PRESETS, type WeightPreset } from '@homed/core';
import { cx } from '@/components/ui';
import { setWeightsPreset } from '@/lib/search/actions';

const CHIP = 'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors';
const OFF = 'border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink';
const ON = 'border-accent bg-accent-soft text-accent';

/**
 * Preset chips. Signed-in: each chip saves the weights (server action). Signed-out: each chip is a link
 * with `preset=<key>` (hrefs supplied by the page). "Custom" shows when the weights match no preset.
 */
export function WeightPresets({
  active,
  signedIn,
  hrefs,
}: {
  active: WeightPreset | 'custom';
  signedIn: boolean;
  hrefs: Record<WeightPreset, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const keys = Object.keys(WEIGHT_PRESETS) as WeightPreset[];

  function choose(key: WeightPreset) {
    setMessage('');
    startTransition(async () => {
      const result = await setWeightsPreset(key);
      if (!result.ok) setMessage(result.message);
    });
  }

  return (
    <div className="grid gap-1.5">
      <div role="group" aria-label="Ranking weights" aria-busy={pending || undefined} className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">Rank by</span>
        {keys.map((key) =>
          signedIn ? (
            <button
              key={key}
              type="button"
              aria-pressed={active === key}
              disabled={pending}
              onClick={() => choose(key)}
              className={cx(CHIP, active === key ? ON : OFF, 'disabled:opacity-60')}
            >
              {WEIGHT_PRESETS[key].label}
            </button>
          ) : (
            <Link key={key} href={hrefs[key]} aria-current={active === key ? 'true' : undefined} className={cx(CHIP, active === key ? ON : OFF)}>
              {WEIGHT_PRESETS[key].label}
            </Link>
          ),
        )}
        <span aria-current={active === 'custom' ? 'true' : undefined} className={cx(CHIP, 'cursor-default', active === 'custom' ? ON : 'border-dashed border-line text-ink-3')}>
          Custom
        </span>
        {signedIn ? (
          <Link href="/settings" className="text-sm text-accent underline underline-offset-2">
            Fine-tune in Settings
          </Link>
        ) : (
          <span className="text-sm text-ink-2">
            <Link href="/signin?next=%2Fsearch" className="text-accent underline underline-offset-2">
              Sign in
            </Link>{' '}
            to save your weights.
          </span>
        )}
      </div>
      <p role="status" className={message ? 'text-sm text-bad' : 'sr-only'}>
        {message}
      </p>
    </div>
  );
}
