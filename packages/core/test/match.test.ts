import { describe, expect, it } from 'vitest';
import { matchQueue } from '../src/match';
import type { RankedListing, Swipe } from '../src/types';

const ranked = (id: string): RankedListing => ({ listing: { floorPlan: { id } } }) as unknown as RankedListing;
const R = ['f1', 'f2', 'f3'].map(ranked);
const ids = (r: RankedListing[]) => r.map((x) => x.listing.floorPlan.id);
const sw = (userId: string, floorPlanId: string, groupId?: string, direction: 'right' | 'left' = 'right'): Swipe => ({
  userId,
  floorPlanId,
  direction,
  createdAt: '2026-01-01T00:00:00Z',
  ...(groupId === undefined ? {} : { groupId }),
});

describe('matchQueue', () => {
  it('empty ranked -> empty', () => expect(matchQueue([], [sw('u', 'f1')], 'u')).toEqual([]));
  it('no swipes -> all in rank order', () => expect(ids(matchQueue(R, [], 'u'))).toEqual(['f1', 'f2', 'f3']));
  it('removes solo-swiped listings (either direction)', () => {
    expect(ids(matchQueue(R, [sw('u', 'f1'), sw('u', 'f3', undefined, 'left')], 'u'))).toEqual(['f2']);
  });
  it('keeps rank order', () => {
    expect(ids(matchQueue(R, [sw('u', 'f2')], 'u'))).toEqual(['f1', 'f3']);
  });
  it('ignores other users swipes', () => {
    expect(ids(matchQueue(R, [sw('other', 'f1')], 'u'))).toEqual(['f1', 'f2', 'f3']);
  });
  it('solo mode ignores group swipes', () => {
    expect(ids(matchQueue(R, [sw('u', 'f1', 'g')], 'u'))).toEqual(['f1', 'f2', 'f3']);
  });
  it('group mode ignores solo swipes', () => {
    expect(ids(matchQueue(R, [sw('u', 'f1')], 'u', 'g'))).toEqual(['f1', 'f2', 'f3']);
  });
  it('group mode removes swipes in that group only', () => {
    const s = [sw('u', 'f1', 'g'), sw('u', 'f2', 'g2'), sw('u', 'f3')];
    expect(ids(matchQueue(R, s, 'u', 'g'))).toEqual(['f2', 'f3']);
  });
  it('group mode ignores other members swipes', () => {
    expect(ids(matchQueue(R, [sw('m2', 'f1', 'g')], 'u', 'g'))).toEqual(['f1', 'f2', 'f3']);
  });
  it('all swiped -> empty', () => {
    expect(matchQueue(R, R.map((r) => sw('u', r.listing.floorPlan.id)), 'u')).toEqual([]);
  });
  it('does not mutate input', () => {
    const copy = [...R];
    matchQueue(R, [sw('u', 'f1')], 'u');
    expect(R).toEqual(copy);
  });
});
