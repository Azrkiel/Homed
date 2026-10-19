import { describe, expect, it } from 'vitest';
import {
  checkGroupName,
  checkId,
  checkInviteCode,
  checkNote,
  checkSwipeDirection,
  checkVote,
} from '../../src/lib/groups/input';

describe('checkGroupName', () => {
  it('trims and accepts 1 to 60 characters', () => {
    expect(checkGroupName('  Oak Street crew ')).toEqual({ ok: true, value: 'Oak Street crew' });
    expect(checkGroupName('x'.repeat(60))).toEqual({ ok: true, value: 'x'.repeat(60) });
  });

  it('rejects blank, too long, and non-string input', () => {
    expect(checkGroupName('   ').ok).toBe(false);
    expect(checkGroupName('x'.repeat(61)).ok).toBe(false);
    expect(checkGroupName(42).ok).toBe(false);
    expect(checkGroupName(undefined).ok).toBe(false);
  });
});

describe('checkInviteCode', () => {
  it('normalizes case and whitespace', () => {
    expect(checkInviteCode(' abc23defg ')).toEqual({ ok: true, value: 'ABC23DEFG' });
  });

  it('rejects odd characters, short codes, and non-strings', () => {
    expect(checkInviteCode('ABC').ok).toBe(false);
    expect(checkInviteCode('ABC/../x').ok).toBe(false);
    expect(checkInviteCode(null).ok).toBe(false);
  });
});

describe('checkId', () => {
  it('accepts seed-style ids', () => {
    expect(checkId('fp-1110-wertland-1br', 'listing')).toEqual({ ok: true, value: 'fp-1110-wertland-1br' });
  });

  it('rejects empty, spaced, too long, and non-string ids', () => {
    expect(checkId('', 'listing').ok).toBe(false);
    expect(checkId('a b', 'listing').ok).toBe(false);
    expect(checkId('a'.repeat(129), 'listing').ok).toBe(false);
    expect(checkId(['a'], 'listing').ok).toBe(false);
  });
});

describe('checkNote', () => {
  it('treats absent and blank notes as undefined', () => {
    expect(checkNote(undefined)).toEqual({ ok: true, value: undefined });
    expect(checkNote('   ')).toEqual({ ok: true, value: undefined });
  });

  it('trims and caps at 280 characters', () => {
    expect(checkNote(' quiet street ')).toEqual({ ok: true, value: 'quiet street' });
    expect(checkNote('x'.repeat(281)).ok).toBe(false);
    expect(checkNote(7).ok).toBe(false);
  });
});

describe('checkVote and checkSwipeDirection', () => {
  it('accepts only 1, 0, -1 for votes', () => {
    expect(checkVote(1)).toEqual({ ok: true, value: 1 });
    expect(checkVote(0)).toEqual({ ok: true, value: 0 });
    expect(checkVote(-1)).toEqual({ ok: true, value: -1 });
    expect(checkVote(2).ok).toBe(false);
    expect(checkVote('1').ok).toBe(false);
  });

  it('accepts only left or right for swipes', () => {
    expect(checkSwipeDirection('left')).toEqual({ ok: true, value: 'left' });
    expect(checkSwipeDirection('right')).toEqual({ ok: true, value: 'right' });
    expect(checkSwipeDirection('up').ok).toBe(false);
  });
});
