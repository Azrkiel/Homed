'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { WEIGHT_PRESETS, type WeightPreset } from '@homed/core';
import { cx } from '@/components/ui';
import { setWeightsPreset } from '@/lib/search/actions';

const CHIP = 'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors';
const OFF = 'border-line bg-surface text-ink-2 hover:border-navy/30 hover:text-ink';
const ON = 'border-navy bg-navy text-white';

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
        {active === 'custom' && (
          <Link href="/settings" aria-current="true" className={cx(CHIP, ON)}>
            Custom
          </Link>
        )}
      </div>
      <p role="status" className={message ? 'text-sm text-bad' : 'sr-only'}>
        {message}
      </p>
    </div>
  );
}
