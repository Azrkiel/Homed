// Pure helpers for the batch builder. No React, no server imports: shared by the client builder and tests.
import { batchTotal, quoteFees, type FeeQuote, type FloorPlan } from '@homed/core';

export interface BuilderPlace {
  floorPlanId: string;
  /** "Property Floor plan", as shown on the saved list. */
  label: string;
  floorPlan: FloorPlan;
}

export interface PlaceFees {
  floorPlanId: string;
  label: string;
  quote: FeeQuote;
}

export interface FeeSummary {
  places: PlaceFees[];
  /** Sum of applicationTotal across places (batchTotal). */
  total: number;
  /** Every complianceIssues message, tagged with its place. */
  warnings: { floorPlanId: string; label: string; message: string }[];
  /** Applicants paying: the leader plus each roommate. */
  people: number;
}

/** Trimmed, lowercased, non-blank roommate entries in order. */
export function roommateEmails(values: readonly string[]): string[] {
  return values.map((v) => v.trim().toLowerCase()).filter((v) => v !== '');
}

/** Leader plus each non-blank roommate. Guarantors are never counted. */
export function applicantCount(roommates: readonly string[]): number {
  return 1 + roommateEmails(roommates).length;
}

/** Fee quote per place, with people = leader + roommates, and the batch total. Uses core quoteFees and batchTotal only. */
export function buildFeeSummary(places: readonly BuilderPlace[], roommates: readonly string[]): FeeSummary {
  const people = applicantCount(roommates);
  const quotes = places.map((p) => ({
    floorPlanId: p.floorPlanId,
    label: p.label,
    quote: quoteFees(p.floorPlan, people),
  }));
  return {
    places: quotes,
    total: batchTotal(quotes.map((q) => q.quote)),
    warnings: quotes.flatMap((q) => q.quote.complianceIssues.map((message) => ({ floorPlanId: q.floorPlanId, label: q.label, message }))),
    people,
  };
}

/** Member emails of a group for the roommate prefill: leader removed, lowercased, deduped, in order. */
export function roommatesFromMembers(emails: readonly string[], leaderEmail: string): string[] {
  const leader = leaderEmail.trim().toLowerCase();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (email === '' || email === leader || out.includes(email)) continue;
    out.push(email);
  }
  return out;
}

/** Values padded with '' up to `min` rows. Longer lists are returned whole. */
export function padRows(values: readonly string[], min: number): string[] {
  const out = [...values];
  while (out.length < min) out.push('');
  return out;
}

/** Choices for "guarantees" on a guarantor row: the leader, then each non-blank roommate. */
export function guarantorOptions(leaderEmail: string, roommates: readonly string[]): string[] {
  const out = [leaderEmail.trim().toLowerCase()];
  for (const email of roommateEmails(roommates)) {
    if (!out.includes(email)) out.push(email);
  }
  return out;
}

export function placeLabel(propertyName: string, floorPlanName: string): string {
  return `${propertyName} ${floorPlanName}`;
}
