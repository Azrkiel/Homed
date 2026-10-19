// Match page helpers: card shaping, ?ids filter, drag outcome, and the deck reducer. Pure, no React.
import { isStale, type ListingBadge, type MatchScore, type Property, type RankedListing } from '@homed/core';
import { minutes } from '../format';
import { hasWalkData } from './results';

/** Serialisable card for the client deck. Built on the server from a RankedListing. */
export interface MatchCard {
  floorPlanId: string;
  propertyName: string;
  floorPlanName: string;
  neighborhood: string;
  bedBath: string;
  kind: Property['kind'];
  /** First real photo, else the first rendering, else null (placeholder). */
  photo: { url: string; alt: string; isRendering: boolean } | null;
  scoreTotal: number;
  /** All-in monthly cost per person. */
  totalMonthly: number;
  why: string;
  /** Walk summary, or null when walk times are unavailable. */
  walk: string | null;
  badges: ListingBadge[];
  lastVerified: string;
  stale: boolean;
  /** Full listing page. */
  href: string;
}

/** "Property Floor plan", used in accessible names and live-region text. */
export function listingName(card: Pick<MatchCard, 'propertyName' | 'floorPlanName'>): string {
  return `${card.propertyName} ${card.floorPlanName}`;
}

/** "About 9 min to class (bus helps)", or null when there is no walk data. */
export function walkSummary(score: MatchScore): string | null {
  if (!hasWalkData(score)) return null;
  const { commute } = score;
  if (commute.earliestClassMinutes !== null) {
    return `About ${minutes(Math.round(commute.averageMinutes))} to class${commute.usesBus ? ' (bus helps)' : ''}`;
  }
  const best = Math.min(...commute.extras.map((e) => e.minutes));
  return `About ${minutes(Math.round(best))} to your landmarks`;
}

/** Real photo first, else rendering, else null. */
function photoFor(photos: RankedListing['listing']['photos']): MatchCard['photo'] {
  const usable = photos.filter((p) => !p.url.startsWith('/placeholder/'));
  const real = usable.find((p) => !p.isRendering);
  const photo = real ?? usable.find((p) => p.isRendering);
  return photo ? { url: photo.url, alt: photo.alt, isRendering: photo.isRendering } : null;
}

/** Card for one ranked listing. `today` is the ISO date used for staleness. */
export function toMatchCard(ranked: RankedListing, today: string): MatchCard {
  const { listing, score } = ranked;
  const { property, floorPlan } = listing;
  const bedBathText = floorPlan.beds === 0 ? `Studio / ${floorPlan.baths} ba` : `${floorPlan.beds} bd / ${floorPlan.baths} ba`;
  return {
    floorPlanId: floorPlan.id,
    propertyName: property.name,
    floorPlanName: floorPlan.name,
    neighborhood: property.neighborhood,
    bedBath: bedBathText,
    kind: property.kind,
    photo: photoFor(listing.photos),
    scoreTotal: score.total,
    totalMonthly: score.cost.totalMonthly,
    why: score.why,
    walk: walkSummary(score),
    badges: score.badges,
    lastVerified: floorPlan.lastVerified,
    stale: isStale(floorPlan.lastVerified, today),
    href: `/listings/${floorPlan.id}`,
  };
}

/**
 * Raw ?ids= value -> unique non-empty ids. Null when the param is absent or empty (no restriction).
 * Accepts comma-separated values and repeated params.
 */
export function parseIdsParam(raw: string | string[] | undefined): string[] | null {
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const ids = [...new Set(values.flatMap((v) => v.split(',')).map((v) => v.trim()).filter((v) => v !== ''))];
  return ids.length > 0 ? ids : null;
}

/** Keeps cards whose floor plan is in `ids`, in the order of `cards` (Best Match). Unknown ids are ignored. */
export function restrictToIds<T extends { floorPlanId: string }>(cards: T[], ids: string[] | null): T[] {
  if (ids === null) return cards;
  const want = new Set(ids);
  return cards.filter((c) => want.has(c.floorPlanId));
}

export type DeckDirection = 'left' | 'right';

export const SWIPE_THRESHOLD_PX = 100;
/** A short flick counts when it moves at least FLICK_MIN_PX and faster than FLICK_SPEED px/ms. */
export const FLICK_MIN_PX = 40;
export const FLICK_SPEED = 0.6;

/** Release outcome of a pointer drag: 'right' (save), 'left' (pass), or null (snap back). Pure. */
export function dragOutcome(dx: number, elapsedMs: number): DeckDirection | null {
  const dist = Math.abs(dx);
  if (dist === 0) return null;
  const speed = dist / Math.max(elapsedMs, 1);
  if (dist >= SWIPE_THRESHOLD_PX || (dist >= FLICK_MIN_PX && speed >= FLICK_SPEED)) return dx > 0 ? 'right' : 'left';
  return null;
}

/** Live-region text for a swipe: "Saved X" or "Passed X". */
export function swipeMessage(direction: DeckDirection, name: string): string {
  return direction === 'right' ? `Saved ${name}` : `Passed ${name}`;
}

export interface DeckLast<T> {
  card: T;
  direction: DeckDirection;
  /** True when a right swipe created a new save (undo then removes it). Set once the server confirms. */
  addedSave: boolean;
}

export interface DeckState<T> {
  queue: T[];
  /** The last swipe only: undo is one level deep. */
  last: DeckLast<T> | null;
}

export type DeckAction<T> =
  | { type: 'swipe'; direction: DeckDirection }
  | { type: 'undo' }
  | { type: 'confirm'; floorPlanId: string; addedSave: boolean }
  | { type: 'restore'; state: DeckState<T> };

/**
 * Optimistic deck state. The client snapshots the state before a server call and dispatches `restore`
 * when the call fails, so it must not dispatch new swipes while a call is in flight.
 */
export function deckReducer<T extends { floorPlanId: string }>(state: DeckState<T>, action: DeckAction<T>): DeckState<T> {
  switch (action.type) {
    case 'swipe': {
      const [card, ...rest] = state.queue;
      if (card === undefined) return state;
      return { queue: rest, last: { card, direction: action.direction, addedSave: false } };
    }
    case 'undo': {
      if (state.last === null) return state;
      return { queue: [state.last.card, ...state.queue], last: null };
    }
    case 'confirm': {
      if (state.last === null || state.last.card.floorPlanId !== action.floorPlanId) return state;
      return { ...state, last: { ...state.last, addedSave: action.addedSave } };
    }
    case 'restore':
      return action.state;
  }
}
