// Pure availability helpers for the landlord dashboard. No I/O.
import { isStale, verifiedLabel, type FloorPlan, type ISODate } from '@homed/core';

export interface AvailabilityState {
  /** More than STALE_AFTER_DAYS since lastVerified: shown in red. */
  stale: boolean;
  /** "Verified today" / "Not verified in 20 days" (verifiedLabel). */
  verifiedText: string;
  /** Human text for unitsAvailable. */
  unitsText: string;
  /** Prefill value for the confirm form ('' when unknown). */
  unitsValue: string;
}

export function availabilityState(fp: Pick<FloorPlan, 'unitsAvailable' | 'lastVerified'>, today: ISODate): AvailabilityState {
  const units = fp.unitsAvailable;
  let unitsText: string;
  if (units === null) unitsText = 'Units not set';
  else if (units === 0) unitsText = 'None available';
  else if (units === 1) unitsText = '1 available';
  else unitsText = `${units} available`;
  return {
    stale: isStale(fp.lastVerified, today),
    verifiedText: verifiedLabel(fp.lastVerified, today),
    unitsText,
    unitsValue: units === null ? '' : String(units),
  };
}

export type UnitsParse = { ok: true; value: number | null } | { ok: false; message: string };

/** Confirm-form input: blank = unknown (null), otherwise a whole number 0-1000. */
export function parseUnitsInput(raw: string | null | undefined): UnitsParse {
  const v = (raw ?? '').trim();
  if (v === '') return { ok: true, value: null };
  if (!/^\d+$/.test(v)) return { ok: false, message: 'Units available must be a whole number.' };
  const n = Number(v);
  if (n > 1000) return { ok: false, message: 'Units available must be 1000 or fewer.' };
  return { ok: true, value: n };
}
