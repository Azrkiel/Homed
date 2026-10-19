import { accommodationBadge } from './accessibility';
import { FEW_LEFT_THRESHOLD } from './alerts';
import { computeCost, peopleInUnit } from './cost';
import { isStale } from './freshness';
import { commuteFor } from './schedule';
import type { ISODate, Listing, ListingBadge, MatchScore, RankedListing, ScoringContext } from './types';
import { normalizeWeights } from './weights';

const clamp = (lo: number, hi: number, v: number): number => Math.min(hi, Math.max(lo, v));

const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Price sub-score: 100 when cost <= 85% of budget, linear to 0 at 100% of budget.
 * Bonus up to +10 (capped at 100) when $/bedroom beats the neighborhood median.
 * `budgetMax` is the effective budget (scoreListing substitutes 1.3 x the overall median when the
 * student has none). Undefined budget -> neutral 50.
 */
export function priceScore(totalMonthly: number, budgetMax: number | undefined, perBedroom: number, neighborhoodMedian: number | undefined): number {
  if (budgetMax === undefined) return 50;
  const ratio = totalMonthly / budgetMax;
  if (ratio >= 1) return 0;
  const base = ratio <= 0.85 ? 100 : (100 * (1 - ratio)) / 0.15;
  let bonus = 0;
  if (neighborhoodMedian !== undefined && neighborhoodMedian > 0) {
    bonus = clamp(0, 10, ((neighborhoodMedian - perBedroom) / neighborhoodMedian) * 50);
  }
  return Math.round(Math.min(100, base + bonus));
}

/** Location sub-score: 100 when average one-way trip <= 5 min, linear to 0 at 30 min. */
export function locationScore(averageMinutes: number): number {
  if (averageMinutes <= 5) return 100;
  if (averageMinutes >= 30) return 0;
  return Math.round((100 * (30 - averageMinutes)) / 25);
}

function hasRealPhotos(listing: Listing): boolean {
  return listing.photos.some((p) => !p.isRendering);
}

function renderingsOnly(listing: Listing): boolean {
  return listing.photos.length > 0 && !hasRealPhotos(listing);
}

/** Looks sub-score from year built/renovated and mean photo rating (real photos only). */
export function looksScore(listing: Listing, today: string): { score: number; basis: MatchScore['looksBasis'] } {
  const currentYear = Number(today.slice(0, 4));
  const { yearBuilt, yearRenovated } = listing.property;
  const years = [yearBuilt, yearRenovated].filter((y): y is number => y !== undefined);
  let age: number;
  if (years.length === 0) {
    age = 50;
  } else {
    const year = Math.max(...years);
    const a = currentYear - year;
    if (year > currentYear || a <= 2) age = 100;
    else if (a >= 40) age = 20;
    else age = 100 - ((a - 2) / 38) * 80;
  }

  let weighted = 0;
  let count = 0;
  for (const p of listing.photos) {
    if (!p.isRendering && p.ratingCount > 0 && p.looksRating !== undefined) {
      weighted += p.looksRating * p.ratingCount;
      count += p.ratingCount;
    }
  }
  if (count > 0) {
    const photo = ((weighted / count - 1) / 4) * 100;
    return { score: Math.round(0.5 * age + 0.5 * photo), basis: 'photos_and_age' };
  }
  return { score: Math.round(age), basis: 'age_only' };
}

function looksWhy(listing: Listing, today: ISODate): string | undefined {
  if (renderingsOnly(listing)) return 'renderings only';
  const currentYear = Number(today.slice(0, 4));
  const { yearBuilt, yearRenovated } = listing.property;
  if (yearRenovated !== undefined) return `renovated ${yearRenovated}`;
  if (yearBuilt !== undefined) {
    if (yearBuilt > currentYear) return `new for ${yearBuilt}`;
    if (yearBuilt >= currentYear - 5) return `built ${yearBuilt}`;
  }
  return undefined;
}

/** Full Best Match score for one listing. Paid placement never enters this function. */
export function scoreListing(listing: Listing, ctx: ScoringContext): MatchScore {
  const { property, floorPlan } = listing;
  const cost = computeCost(floorPlan, property);
  const commute = commuteFor(property.id, ctx.meetings, ctx.extras, ctx.walk);

  // Price
  const allMedian = ctx.neighborhoodMedians['__all__'];
  const effectiveBudget =
    ctx.budgetMax !== undefined ? ctx.budgetMax : allMedian !== undefined ? Math.round(1.3 * allMedian) : undefined;
  const price = priceScore(cost.totalMonthly, effectiveBudget, cost.rent, ctx.neighborhoodMedians[property.neighborhood]);

  // Location: meetings, else extras, else the Lawn, else neutral.
  const meetingsResolved = ctx.meetings.some((m) => ctx.walk(property.id, m.buildingId) !== undefined);
  let locMinutes: number | undefined;
  let locWhy: string;
  if (ctx.meetings.length > 0 && meetingsResolved) {
    locMinutes = commute.averageMinutes;
    locWhy = `${Math.round(locMinutes)} min to your classes`;
  } else if (commute.extras.length > 0) {
    locMinutes = commute.extras.reduce((s, e) => s + e.minutes, 0) / commute.extras.length;
    locWhy = `${Math.round(locMinutes)} min to your spots`;
  } else {
    const lawn = ctx.walk(property.id, 'lawn');
    if (lawn) {
      locMinutes = lawn.walkMinutes;
      locWhy = `${Math.round(locMinutes)} min to the Lawn`;
    } else {
      locWhy = 'walk times unavailable';
    }
  }
  const location = locMinutes === undefined ? 50 : locationScore(locMinutes);

  const looks = looksScore(listing, ctx.today);

  const w = normalizeWeights(ctx.weights);
  const total = Math.round(w.price * price + w.location * location + w.looks * looks.score);

  let priceWhy: string;
  if (ctx.budgetMax !== undefined) {
    const diff = Math.round(ctx.budgetMax - cost.totalMonthly);
    priceWhy = diff > 0 ? `${money(diff)} under budget` : diff < 0 ? `${money(-diff)} over budget` : 'right at budget';
  } else {
    priceWhy = `${money(cost.totalMonthly)}/mo all-in`;
  }
  const why = [priceWhy, locWhy, looksWhy(listing, ctx.today)].filter((p): p is string => p !== undefined).join(' · ');

  const badges: ListingBadge[] = [];
  if (renderingsOnly(listing)) badges.push('renderings_only');
  if (isStale(floorPlan.lastVerified, ctx.today)) badges.push('stale');
  if (accommodationBadge(listing.accessibility).friendly) badges.push('accommodation_friendly');
  const left = floorPlan.unitsAvailable;
  if (left !== null && left >= 1 && left <= FEW_LEFT_THRESHOLD) badges.push('few_left');
  if (floorPlan.baths >= peopleInUnit(floorPlan)) badges.push('private_bath');
  if (property.onGrounds) badges.push('on_grounds');
  if (floorPlan.leaseType === 'individual') badges.push('individual_lease');

  return { total, price, location, looks: looks.score, looksBasis: looks.basis, why, cost, commute, badges };
}

/** Score and sort descending by total; ties broken by lower cost, then name. */
export function rankListings(listings: Listing[], ctx: ScoringContext): RankedListing[] {
  return listings
    .map((listing) => ({ listing, score: scoreListing(listing, ctx) }))
    .sort((a, b) => {
      if (b.score.total !== a.score.total) return b.score.total - a.score.total;
      if (a.score.cost.totalMonthly !== b.score.cost.totalMonthly) return a.score.cost.totalMonthly - b.score.cost.totalMonthly;
      const an = a.listing.property.name;
      const bn = b.listing.property.name;
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Median $/bedroom (per-person rent) per neighborhood, plus "__all__". */
export function neighborhoodMedians(listings: Listing[]): Record<string, number> {
  if (listings.length === 0) return {};
  const groups = new Map<string, number[]>();
  const all: number[] = [];
  for (const l of listings) {
    const rent = computeCost(l.floorPlan, l.property).rent;
    all.push(rent);
    const g = groups.get(l.property.neighborhood);
    if (g) g.push(rent);
    else groups.set(l.property.neighborhood, [rent]);
  }
  const out: Record<string, number> = {};
  for (const [k, v] of groups) out[k] = median(v);
  out['__all__'] = median(all);
  return out;
}
