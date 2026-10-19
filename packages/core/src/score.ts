import type { Listing, MatchScore, RankedListing, ScoringContext } from './types';
import { notImplemented } from './not-implemented';

/**
 * Price sub-score: 100 when cost <= 85% of budget, linear to 0 at 100% of budget.
 * Bonus up to +10 (capped at 100) when $/bedroom beats the neighborhood median.
 * No budget: score against the cheapest-to-priciest spread of the neighborhood medians (see plan).
 */
export function priceScore(totalMonthly: number, budgetMax: number | undefined, perBedroom: number, neighborhoodMedian: number | undefined): number {
  return notImplemented('priceScore');
}

/** Location sub-score: 100 when average one-way trip <= 5 min, linear to 0 at 30 min. No meetings: use extras, else distance to the Lawn landmark ("lawn"). */
export function locationScore(averageMinutes: number): number {
  return notImplemented('locationScore');
}

/** Looks sub-score from year built/renovated and mean photo rating (real photos only). */
export function looksScore(listing: Listing, today: string): { score: number; basis: MatchScore['looksBasis'] } {
  return notImplemented('looksScore');
}

/** Full Best Match score for one listing. Paid placement never enters this function. */
export function scoreListing(listing: Listing, ctx: ScoringContext): MatchScore {
  return notImplemented('scoreListing');
}

/** Score and sort descending by total; ties broken by lower cost, then name. */
export function rankListings(listings: Listing[], ctx: ScoringContext): RankedListing[] {
  return notImplemented('rankListings');
}

/** Median $/bedroom (per-person rent) per neighborhood. */
export function neighborhoodMedians(listings: Listing[]): Record<string, number> {
  return notImplemented('neighborhoodMedians');
}
