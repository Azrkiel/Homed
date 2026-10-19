// Landlord-facing fee checks. The rule itself lives in @homed/core quoteFees; this only reuses its output.
import { quoteFees, type FloorPlan } from '@homed/core';

/** Compliance messages for a floor plan's fees (empty when fine). Same text the student quote shows. */
export function feeWarnings(fp: Pick<FloorPlan, 'applicationFee' | 'screeningCost' | 'applicationDeposit' | 'securityDeposit'>): string[] {
  // quoteFees reads only the fee fields; the cast only supplies the fields it never touches.
  return quoteFees(fp as FloorPlan, 1).complianceIssues;
}
