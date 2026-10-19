import type { FloorPlan, FeeQuote } from './types';
import { notImplemented } from './not-implemented';

/**
 * Va. Code 55.1-1203 (as of 2026): a landlord may charge a nonrefundable application fee of at most
 * $50, plus the actual cost of third-party screening (credit and criminal checks), and may take a
 * refundable application deposit. A revised version takes effect 2027-07-01: a lawyer must review
 * this module against it before launch.
 */
export const VA_MAX_NONREFUNDABLE_FEE = 50;

/**
 * Fee quote for one application with `people` applicants (roommates; guarantors pay nothing).
 * perPerson lines: "Application fee" (nonrefundable, applicationFee ?? 0), "Screening cost"
 * (nonrefundable, screeningCost ?? 0), "Refundable application deposit" (applicationDeposit ?? 0).
 * Zero lines are omitted. complianceIssues gets a message when applicationFee > VA_MAX_NONREFUNDABLE_FEE.
 */
export function quoteFees(fp: FloorPlan, people: number): FeeQuote {
  return notImplemented('quoteFees');
}

/** Sum of applicationTotal across a batch (shown before anyone submits). */
export function batchTotal(quotes: FeeQuote[]): number {
  return notImplemented('batchTotal');
}
