// Pure review helpers: averages, noise tag, form parsing. No server imports, so tests run in node.
import type { Review, ReviewRatings } from '@homed/core';

export const REVIEW_MAX_CHARS = 2000;
export const RATING_KEYS = ['noise', 'maintenance', 'landlordResponsiveness', 'value'] as const;

export type ReviewParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface ReviewSummary {
  count: number;
  averages: {
    noise: number | null;
    maintenance: number | null;
    landlordResponsiveness: number | null;
    value: number | null;
  };
  accommodation: { average: number; count: number } | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Averages over the reviews given (callers pass published reviews). Averages are null with no reviews. */
export function summarizeReviews(reviews: Review[]): ReviewSummary {
  const pick = (k: (typeof RATING_KEYS)[number]) => mean(reviews.map((r) => r.ratings[k]));
  const accommodationValues = reviews
    .map((r) => r.ratings.accommodation)
    .filter((v): v is number => typeof v === 'number');
  const accommodationAvg = mean(accommodationValues);
  return {
    count: reviews.length,
    averages: {
      noise: pick('noise'),
      maintenance: pick('maintenance'),
      landlordResponsiveness: pick('landlordResponsiveness'),
      value: pick('value'),
    },
    accommodation: accommodationAvg === null ? null : { average: accommodationAvg, count: accommodationValues.length },
  };
}

/** Noise average (1 = loud, 5 = quiet) -> label. */
export function noiseTag(avgNoise: number): 'Loud' | 'Moderate' | 'Quiet' {
  if (avgNoise < 2.5) return 'Loud';
  if (avgNoise <= 3.5) return 'Moderate';
  return 'Quiet';
}

function rating(fd: FormData, key: string, label: string, required: boolean): ReviewParseResult<number | undefined> {
  const raw = fd.get(key);
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') {
    if (required) return { ok: false, message: `Pick a ${label} rating from 1 to 5.` };
    return { ok: true, value: undefined };
  }
  if (!/^\d+$/.test(text)) return { ok: false, message: `${label} rating must be a whole number from 1 to 5.` };
  const n = Number(text);
  if (n < 1 || n > 5) return { ok: false, message: `${label} rating must be from 1 to 5.` };
  return { ok: true, value: n };
}

/** Form fields: noise, maintenance, landlordResponsiveness, value (required), accommodation (optional), text. */
export function parseReviewForm(
  fd: FormData,
): ReviewParseResult<{ ratings: ReviewRatings; text: string }> {
  const labels: Record<(typeof RATING_KEYS)[number], string> = {
    noise: 'Noise',
    maintenance: 'Maintenance',
    landlordResponsiveness: 'Landlord responsiveness',
    value: 'Value',
  };
  const parsed: Record<string, number> = {};
  for (const k of RATING_KEYS) {
    const r = rating(fd, k, labels[k], true);
    if (!r.ok) return r;
    parsed[k] = r.value as number;
  }
  const acc = rating(fd, 'accommodation', 'Accommodation', false);
  if (!acc.ok) return acc;

  const rawText = fd.get('text');
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (text === '') return { ok: false, message: 'Write a few words about your experience.' };
  if (text.length > REVIEW_MAX_CHARS) return { ok: false, message: `Keep your review under ${REVIEW_MAX_CHARS} characters.` };

  const ratings: ReviewRatings = {
    noise: parsed.noise as number,
    maintenance: parsed.maintenance as number,
    landlordResponsiveness: parsed.landlordResponsiveness as number,
    value: parsed.value as number,
  };
  if (acc.value !== undefined) ratings.accommodation = acc.value;
  return { ok: true, value: { ratings, text } };
}

/** Form field: reply. Required, trimmed, max 2000 chars. */
export function parseReplyForm(fd: FormData): ReviewParseResult<string> {
  const raw = fd.get('reply');
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return { ok: false, message: 'Write a reply before sending.' };
  if (text.length > REVIEW_MAX_CHARS) return { ok: false, message: `Keep your reply under ${REVIEW_MAX_CHARS} characters.` };
  return { ok: true, value: text };
}
