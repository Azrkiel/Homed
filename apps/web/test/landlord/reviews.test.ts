import { describe, expect, it } from 'vitest';
import type { Review } from '@homed/core';
import {
  REVIEW_MAX_CHARS,
  noiseTag,
  parseReplyForm,
  parseReviewForm,
  summarizeReviews,
} from '../../src/lib/reviews/summary';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const GOOD = { noise: '4', maintenance: '3', landlordResponsiveness: '5', value: '2', text: '  Quiet street.  ' };

function review(over: Partial<Review['ratings']>, status: Review['status'] = 'published'): Review {
  return {
    id: Math.random().toString(36),
    propertyId: 'p1',
    userId: 'u1',
    status,
    text: 'x',
    createdAt: '2026-10-01T00:00:00.000Z',
    ratings: { noise: 3, maintenance: 3, landlordResponsiveness: 3, value: 3, ...over },
  };
}

describe('summarizeReviews', () => {
  it('returns null averages and null accommodation with no reviews', () => {
    expect(summarizeReviews([])).toEqual({
      count: 0,
      averages: { noise: null, maintenance: null, landlordResponsiveness: null, value: null },
      accommodation: null,
    });
  });

  it('averages each dimension to one decimal', () => {
    const s = summarizeReviews([
      review({ noise: 1, maintenance: 5, landlordResponsiveness: 4, value: 2 }),
      review({ noise: 2, maintenance: 5, landlordResponsiveness: 4, value: 2 }),
      review({ noise: 2, maintenance: 4, landlordResponsiveness: 5, value: 3 }),
    ]);
    expect(s.count).toBe(3);
    expect(s.averages.noise).toBe(1.7);
    expect(s.averages.maintenance).toBe(4.7);
    expect(s.averages.landlordResponsiveness).toBe(4.3);
    expect(s.averages.value).toBe(2.3);
  });

  it('averages accommodation only over reviews that rated it', () => {
    const s = summarizeReviews([review({ accommodation: 5 }), review({ accommodation: 4 }), review({})]);
    expect(s.accommodation).toEqual({ average: 4.5, count: 2 });
  });
});

describe('noiseTag', () => {
  it('maps the thresholds: <2.5 Loud, <=3.5 Moderate, else Quiet', () => {
    expect(noiseTag(1)).toBe('Loud');
    expect(noiseTag(2.4)).toBe('Loud');
    expect(noiseTag(2.5)).toBe('Moderate');
    expect(noiseTag(3.5)).toBe('Moderate');
    expect(noiseTag(3.6)).toBe('Quiet');
    expect(noiseTag(5)).toBe('Quiet');
  });
});

describe('parseReviewForm', () => {
  it('parses ratings and trims text', () => {
    const r = parseReviewForm(form(GOOD));
    expect(r).toEqual({
      ok: true,
      value: {
        ratings: { noise: 4, maintenance: 3, landlordResponsiveness: 5, value: 2 },
        text: 'Quiet street.',
      },
    });
  });

  it('includes accommodation when given and omits it when blank', () => {
    const withAcc = parseReviewForm(form({ ...GOOD, accommodation: '5' }));
    expect(withAcc.ok && withAcc.value.ratings.accommodation).toBe(5);
    const blank = parseReviewForm(form({ ...GOOD, accommodation: '' }));
    expect(blank.ok && 'accommodation' in blank.value.ratings).toBe(false);
  });

  it('requires all four ratings as integers 1-5', () => {
    for (const key of ['noise', 'maintenance', 'landlordResponsiveness', 'value']) {
      const missing = { ...GOOD, [key]: '' };
      expect(parseReviewForm(form(missing)).ok).toBe(false);
      expect(parseReviewForm(form({ ...GOOD, [key]: '0' })).ok).toBe(false);
      expect(parseReviewForm(form({ ...GOOD, [key]: '6' })).ok).toBe(false);
      expect(parseReviewForm(form({ ...GOOD, [key]: '3.5' })).ok).toBe(false);
      expect(parseReviewForm(form({ ...GOOD, [key]: 'abc' })).ok).toBe(false);
    }
  });

  it('rejects an out-of-range accommodation rating', () => {
    expect(parseReviewForm(form({ ...GOOD, accommodation: '9' })).ok).toBe(false);
  });

  it('requires text after trimming and caps its length', () => {
    expect(parseReviewForm(form({ ...GOOD, text: '   ' })).ok).toBe(false);
    expect(parseReviewForm(form({ ...GOOD, text: 'a'.repeat(REVIEW_MAX_CHARS) })).ok).toBe(true);
    expect(parseReviewForm(form({ ...GOOD, text: 'a'.repeat(REVIEW_MAX_CHARS + 1) })).ok).toBe(false);
  });
});

describe('parseReplyForm', () => {
  it('requires a trimmed reply up to the limit', () => {
    expect(parseReplyForm(form({ reply: '  Thanks, we fixed it.  ' }))).toEqual({ ok: true, value: 'Thanks, we fixed it.' });
    expect(parseReplyForm(form({ reply: '  ' })).ok).toBe(false);
    expect(parseReplyForm(form({})).ok).toBe(false);
    expect(parseReplyForm(form({ reply: 'a'.repeat(REVIEW_MAX_CHARS + 1) })).ok).toBe(false);
  });
});
