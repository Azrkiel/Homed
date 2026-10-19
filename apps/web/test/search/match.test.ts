import { describe, expect, it } from 'vitest';
import { matchQueue, type MatchScore, type RankedListing, type Swipe } from '@homed/core';
import {
  FLICK_MIN_PX,
  SWIPE_THRESHOLD_PX,
  deckReducer,
  dragOutcome,
  listingName,
  parseIdsParam,
  restrictToIds,
  swipeMessage,
  toMatchCard,
  walkSummary,
  type DeckState,
  type MatchCard,
} from '../../src/lib/search/match';

function ranked(id: string, total: number, opts: { rendering?: boolean; walk?: boolean; stale?: boolean } = {}): RankedListing {
  const commute = opts.walk === false
    ? { weeklyMinutes: 0, averageMinutes: 0, earliestClassMinutes: null, usesBus: false, extras: [] }
    : { weeklyMinutes: 40, averageMinutes: 9.4, earliestClassMinutes: 6, usesBus: true, extras: [] };
  return {
    listing: {
      property: { id: `p-${id}`, name: `Prop ${id}`, neighborhood: 'Rugby Road', kind: 'apartment_complex' },
      floorPlan: {
        id,
        name: `Plan ${id}`,
        beds: 2,
        baths: 2,
        lastVerified: opts.stale ? '2026-01-01' : '2026-10-18',
      },
      photos: opts.rendering
        ? [{ id: 'ph', url: '/r.png', alt: 'Render', isRendering: true }]
        : [
            { id: 'ph1', url: '/r.png', alt: 'Render', isRendering: true },
            { id: 'ph2', url: '/real.jpg', alt: 'Real', isRendering: false },
          ],
    } as unknown as RankedListing['listing'],
    score: {
      total,
      why: `why ${id}`,
      cost: { totalMonthly: 900 },
      commute,
      badges: ['few_left'],
    } as unknown as MatchScore,
  };
}

function card(id: string): MatchCard {
  return toMatchCard(ranked(id, 80), '2026-10-19');
}

describe('parseIdsParam', () => {
  it('returns null when absent or empty (no restriction)', () => {
    expect(parseIdsParam(undefined)).toBeNull();
    expect(parseIdsParam('')).toBeNull();
    expect(parseIdsParam(' , ')).toBeNull();
  });
  it('splits comma lists, trims, dedupes and accepts repeated params', () => {
    expect(parseIdsParam('a, b,a,,c')).toEqual(['a', 'b', 'c']);
    expect(parseIdsParam(['a,b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('restrictToIds', () => {
  const cards = [card('a'), card('b'), card('c')];
  it('keeps everything when ids is null', () => {
    expect(restrictToIds(cards, null)).toHaveLength(3);
  });
  it('keeps Best Match order and ignores unknown ids', () => {
    expect(restrictToIds(cards, ['c', 'zzz', 'a']).map((c) => c.floorPlanId)).toEqual(['a', 'c']);
  });
  it('returns nothing when no id matches', () => {
    expect(restrictToIds(cards, ['zzz'])).toEqual([]);
  });
});

describe('dragOutcome', () => {
  it('returns null for no movement or a small slow drag (snap back)', () => {
    expect(dragOutcome(0, 100)).toBeNull();
    expect(dragOutcome(SWIPE_THRESHOLD_PX - 1, 1000)).toBeNull();
    expect(dragOutcome(-20, 500)).toBeNull();
  });
  it('swipes past the threshold in either direction', () => {
    expect(dragOutcome(SWIPE_THRESHOLD_PX, 800)).toBe('right');
    expect(dragOutcome(-SWIPE_THRESHOLD_PX - 5, 800)).toBe('left');
  });
  it('counts a fast flick below the threshold', () => {
    expect(dragOutcome(FLICK_MIN_PX + 5, 30)).toBe('right');
    expect(dragOutcome(-FLICK_MIN_PX - 5, 30)).toBe('left');
    expect(dragOutcome(FLICK_MIN_PX + 5, 2000)).toBeNull();
  });
  it('treats zero elapsed time safely', () => {
    expect(dragOutcome(SWIPE_THRESHOLD_PX, 0)).toBe('right');
  });
});

describe('walkSummary', () => {
  it('null without walk data', () => {
    expect(walkSummary(ranked('a', 1, { walk: false }).score)).toBeNull();
  });
  it('names the average class walk and the bus', () => {
    expect(walkSummary(ranked('a', 1).score)).toBe('About 9 min to class (bus helps)');
  });
  it('falls back to landmarks when there is no class trip', () => {
    const score = {
      commute: { weeklyMinutes: 5, averageMinutes: 0, earliestClassMinutes: null, usesBus: false, extras: [{ landmarkId: 'gym', minutes: 12 }, { landmarkId: 'x', minutes: 7 }] },
    } as unknown as MatchScore;
    expect(walkSummary(score)).toBe('About 7 min to your landmarks');
  });
});

describe('toMatchCard', () => {
  it('prefers a real photo over a rendering and carries the why line and cost', () => {
    const c = toMatchCard(ranked('a', 83), '2026-10-19');
    expect(c.photo).toEqual({ url: '/real.jpg', alt: 'Real', isRendering: false });
    expect(c.scoreTotal).toBe(83);
    expect(c.totalMonthly).toBe(900);
    expect(c.why).toBe('why a');
    expect(c.bedBath).toBe('2 bd / 2 ba');
    expect(c.href).toBe('/listings/a');
    expect(c.stale).toBe(false);
    expect(c.walk).toBe('About 9 min to class (bus helps)');
  });
  it('falls back to the rendering, then null', () => {
    expect(toMatchCard(ranked('a', 1, { rendering: true }), '2026-10-19').photo?.isRendering).toBe(true);
    const bare = ranked('a', 1);
    bare.listing.photos = [];
    expect(toMatchCard(bare, '2026-10-19').photo).toBeNull();
  });
  it('marks stale listings and reports missing walk data as null', () => {
    const c = toMatchCard(ranked('a', 1, { stale: true, walk: false }), '2026-10-19');
    expect(c.stale).toBe(true);
    expect(c.walk).toBeNull();
  });
  it('names the listing for screen readers and the live region', () => {
    expect(listingName(card('a'))).toBe('Prop a Plan a');
    expect(swipeMessage('right', 'Prop a Plan a')).toBe('Saved Prop a Plan a');
    expect(swipeMessage('left', 'Prop a Plan a')).toBe('Passed Prop a Plan a');
  });
});

describe('matchQueue with solo swipes (queue feeds the deck)', () => {
  it('drops swiped floor plans whatever the direction, keeps rank order', () => {
    const ranks = [ranked('a', 90), ranked('b', 80), ranked('c', 70)];
    const swipes: Swipe[] = [
      { userId: 'u', floorPlanId: 'b', direction: 'left', createdAt: '2026-10-19T00:00:00Z' },
    ];
    expect(matchQueue(ranks, swipes, 'u').map((r) => r.listing.floorPlan.id)).toEqual(['a', 'c']);
  });
});

describe('deckReducer', () => {
  const start = (ids: string[]): DeckState<MatchCard> => ({ queue: ids.map(card), last: null });
  const ids = (s: DeckState<MatchCard>) => s.queue.map((c) => c.floorPlanId);

  it('swipe pops the front card and remembers it for undo', () => {
    const s = deckReducer(start(['a', 'b', 'c']), { type: 'swipe', direction: 'right' });
    expect(ids(s)).toEqual(['b', 'c']);
    expect(s.last?.card.floorPlanId).toBe('a');
    expect(s.last?.direction).toBe('right');
    expect(s.last?.addedSave).toBe(false);
  });

  it('swipe on an empty queue is a no-op', () => {
    const empty = start([]);
    expect(deckReducer(empty, { type: 'swipe', direction: 'left' })).toBe(empty);
  });

  it('confirm records whether the server added a save, only for the matching card', () => {
    let s = deckReducer(start(['a', 'b']), { type: 'swipe', direction: 'right' });
    s = deckReducer(s, { type: 'confirm', floorPlanId: 'zzz', addedSave: true });
    expect(s.last?.addedSave).toBe(false);
    s = deckReducer(s, { type: 'confirm', floorPlanId: 'a', addedSave: true });
    expect(s.last?.addedSave).toBe(true);
  });

  it('undo puts the card back at the front and clears last (one level)', () => {
    let s = deckReducer(start(['a', 'b']), { type: 'swipe', direction: 'left' });
    s = deckReducer(s, { type: 'undo' });
    expect(ids(s)).toEqual(['a', 'b']);
    expect(s.last).toBeNull();
    expect(deckReducer(s, { type: 'undo' })).toBe(s);
  });

  it('restore returns the snapshot unchanged', () => {
    const before = start(['a', 'b']);
    const after = deckReducer(before, { type: 'swipe', direction: 'right' });
    expect(deckReducer(after, { type: 'restore', state: before })).toBe(before);
  });
});
