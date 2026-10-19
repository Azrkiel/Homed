import { describe, expect, it } from 'vitest';
import { addFloorPlan, parseBatchForm, reorder } from '../../src/lib/apply/batch';

const LEADER = 'Leader@Virginia.edu';
const opts = { leaderEmail: LEADER };

function form(parts: [string, string][]): URLSearchParams {
  return new URLSearchParams(parts);
}

function messageOf(parts: [string, string][]): string {
  const r = parseBatchForm(form(parts), opts);
  if (r.ok) throw new Error('expected failure');
  return r.message;
}

describe('parseBatchForm: floor plans', () => {
  it('keeps floor plan order and drops blanks and duplicates', () => {
    const r = parseBatchForm(form([['fp', 'fp-b'], ['fp', ''], ['fp', 'fp-a'], ['fp', 'fp-b']]), opts);
    expect(r).toEqual({ ok: true, floorPlanIds: ['fp-b', 'fp-a'], invitees: [] });
  });

  it('requires at least one floor plan', () => {
    expect(messageOf([['fp', ' ']])).toMatch(/at least one/);
    expect(messageOf([])).toMatch(/at least one/);
  });

  it('caps the batch at MAX_BATCH_SIZE (3)', () => {
    expect(messageOf([['fp', 'a'], ['fp', 'b'], ['fp', 'c'], ['fp', 'd']])).toMatch(/at most 3/);
    const ok = parseBatchForm(form([['fp', 'a'], ['fp', 'b'], ['fp', 'c'], ['fp', 'a']]), opts);
    expect(ok.ok && ok.floorPlanIds).toEqual(['a', 'b', 'c']);
  });
});

describe('parseBatchForm: group', () => {
  it('includes groupId when given and omits it when blank', () => {
    const withGroup = parseBatchForm(form([['fp', 'a'], ['groupId', ' grp-1 ']]), opts);
    expect(withGroup).toEqual({ ok: true, floorPlanIds: ['a'], groupId: 'grp-1', invitees: [] });
    const blank = parseBatchForm(form([['fp', 'a'], ['groupId', '']]), opts);
    expect(blank.ok && 'groupId' in blank).toBe(false);
  });
});

describe('parseBatchForm: roommates', () => {
  it('lowercases, trims and ignores blank roommate fields', () => {
    const r = parseBatchForm(form([['fp', 'a'], ['roommate', '  Sam@Virginia.edu '], ['roommate', ''], ['roommate', 'alex@virginia.edu']]), opts);
    expect(r.ok && r.invitees).toEqual([
      { kind: 'roommate', email: 'sam@virginia.edu' },
      { kind: 'roommate', email: 'alex@virginia.edu' },
    ]);
  });

  it('rejects an invalid roommate email', () => {
    expect(messageOf([['fp', 'a'], ['roommate', 'not-an-email']])).toMatch(/not a valid email/);
  });

  it('rejects the leader as a roommate, ignoring case', () => {
    expect(messageOf([['fp', 'a'], ['roommate', 'leader@virginia.edu']])).toMatch(/yourself/);
  });

  it('rejects a roommate listed twice', () => {
    expect(messageOf([['fp', 'a'], ['roommate', 'sam@virginia.edu'], ['roommate', 'SAM@virginia.edu']])).toMatch(/already in this batch/);
  });
});

describe('parseBatchForm: guarantors', () => {
  it('reads guarantors by index in ascending order, with optional name and guarantorFor', () => {
    const r = parseBatchForm(
      form([
        ['fp', 'a'],
        ['roommate', 'sam@virginia.edu'],
        ['guarantorEmail_2', 'Gina@Example.com'],
        ['guarantorName_2', ' Gina Rey '],
        ['guarantorFor_2', 'SAM@virginia.edu'],
        ['guarantorEmail_0', 'pat@example.com'],
        ['guarantorFor_0', LEADER],
      ]),
      opts,
    );
    expect(r.ok && r.invitees).toEqual([
      { kind: 'roommate', email: 'sam@virginia.edu' },
      { kind: 'guarantor', email: 'pat@example.com', guarantorForEmail: 'leader@virginia.edu' },
      { kind: 'guarantor', email: 'gina@example.com', name: 'Gina Rey', guarantorForEmail: 'sam@virginia.edu' },
    ]);
  });

  it('allows a guarantor with no guarantorFor', () => {
    const r = parseBatchForm(form([['fp', 'a'], ['guarantorEmail_0', 'pat@example.com']]), opts);
    expect(r.ok && r.invitees).toEqual([{ kind: 'guarantor', email: 'pat@example.com' }]);
  });

  it('ignores fully blank guarantor rows', () => {
    const r = parseBatchForm(form([['fp', 'a'], ['guarantorEmail_0', ''], ['guarantorName_0', ' '], ['guarantorFor_0', '']]), opts);
    expect(r.ok && r.invitees).toEqual([]);
  });

  it('requires an email when a guarantor row has other fields', () => {
    expect(messageOf([['fp', 'a'], ['guarantorName_0', 'Pat']])).toMatch(/needs an email/);
  });

  it('rejects an invalid guarantor email', () => {
    expect(messageOf([['fp', 'a'], ['guarantorEmail_0', 'pat@']])).toMatch(/not a valid email/);
  });

  it('rejects the leader as their own guarantor', () => {
    expect(messageOf([['fp', 'a'], ['guarantorEmail_0', LEADER]])).toMatch(/own guarantor/);
  });

  it('rejects a guarantor whose email is already a roommate', () => {
    expect(messageOf([['fp', 'a'], ['roommate', 'sam@virginia.edu'], ['guarantorEmail_0', 'SAM@virginia.edu']])).toMatch(/already in this batch/);
  });

  it('rejects two guarantors with the same email', () => {
    expect(messageOf([['fp', 'a'], ['guarantorEmail_0', 'pat@example.com'], ['guarantorEmail_1', 'pat@example.com']])).toMatch(/already in this batch/);
  });

  it('rejects guarantorFor that is not the leader or a listed roommate', () => {
    expect(messageOf([['fp', 'a'], ['guarantorEmail_0', 'pat@example.com'], ['guarantorFor_0', 'stranger@virginia.edu']])).toMatch(/guarantee the leader or a roommate/);
  });

  it('rejects guarantorFor pointing at another guarantor', () => {
    expect(
      messageOf([['fp', 'a'], ['guarantorEmail_0', 'pat@example.com'], ['guarantorEmail_1', 'gina@example.com'], ['guarantorFor_1', 'pat@example.com']]),
    ).toMatch(/guarantee the leader or a roommate/);
  });

  it('rejects an over-long guarantor name', () => {
    expect(messageOf([['fp', 'a'], ['guarantorEmail_0', 'pat@example.com'], ['guarantorName_0', 'n'.repeat(121)]])).toMatch(/120/);
  });
});

describe('reorder', () => {
  it('moves an item forward and backward without touching the input', () => {
    const list = ['a', 'b', 'c'];
    expect(reorder(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorder(list, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('returns a copy for same index or out-of-range indexes', () => {
    const list = ['a', 'b'];
    expect(reorder(list, 1, 1)).toEqual(['a', 'b']);
    expect(reorder(list, -1, 0)).toEqual(['a', 'b']);
    expect(reorder(list, 0, 2)).toEqual(['a', 'b']);
    expect(reorder(list, 0.5, 1)).toEqual(['a', 'b']);
    expect(reorder(list, 0, 1)).not.toBe(list);
  });
});

describe('addFloorPlan', () => {
  it('appends a new id', () => {
    expect(addFloorPlan(['a'], ' b ')).toEqual(['a', 'b']);
  });

  it('ignores duplicates, blanks and anything past the cap', () => {
    expect(addFloorPlan(['a', 'b'], 'a')).toEqual(['a', 'b']);
    expect(addFloorPlan(['a'], '  ')).toEqual(['a']);
    expect(addFloorPlan(['a', 'b', 'c'], 'd')).toEqual(['a', 'b', 'c']);
  });
});
