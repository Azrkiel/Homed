import { describe, expect, it } from 'vitest';
import { ACCESSIBILITY_FEATURE_LABELS, accommodationBadge } from '../src/accessibility';
import type { AccessibilityFeature, AccessibilityInfo } from '../src/types';

const ALL_FEATURES: AccessibilityFeature[] = [
  'step_free_entrance', 'elevator', 'ground_floor_units', 'wide_doorways', 'roll_in_shower', 'grab_bars',
  'flashing_alarms', 'quiet_units', 'private_bathroom', 'kitchen_access', 'gender_inclusive_units',
  'kosher_halal_kitchen',
];

function info(over: Partial<AccessibilityInfo> = {}): AccessibilityInfo {
  return {
    propertyId: 'p1', features: ['step_free_entrance', 'elevator'], photoConfirmed: [],
    accommodationContact: 'Dana, 434-555-0100', accommodationProcess: 'Email the office with documentation.',
    assistanceAnimals: { serviceAnimalsAllowed: true, esaAllowed: true, noFees: true },
    updatedAt: '2026-10-01', ...over,
  };
}

describe('ACCESSIBILITY_FEATURE_LABELS', () => {
  it('has a non-empty label for every feature', () => {
    for (const f of ALL_FEATURES) expect(ACCESSIBILITY_FEATURE_LABELS[f]).toBeTruthy();
    expect(Object.keys(ACCESSIBILITY_FEATURE_LABELS).sort()).toEqual([...ALL_FEATURES].sort());
  });
});

describe('accommodationBadge', () => {
  it('undefined info -> not friendly, all five missing', () => {
    const b = accommodationBadge(undefined);
    expect(b.friendly).toBe(false);
    expect(b.reasons).toEqual([]);
    expect(b.missing).toHaveLength(5);
  });
  it('all criteria met -> friendly, no missing', () => {
    const b = accommodationBadge(info());
    expect(b.friendly).toBe(true);
    expect(b.missing).toEqual([]);
    expect(b.reasons).toHaveLength(5);
  });
  it('ground-floor units can replace the elevator', () => {
    expect(accommodationBadge(info({ features: ['step_free_entrance', 'ground_floor_units'] })).friendly).toBe(true);
  });
  it('missing step-free entrance', () => {
    const b = accommodationBadge(info({ features: ['elevator'] }));
    expect(b.friendly).toBe(false);
    expect(b.missing).toEqual(['Step-free entrance']);
  });
  it('neither elevator nor ground floor', () => {
    const b = accommodationBadge(info({ features: ['step_free_entrance'] }));
    expect(b.friendly).toBe(false);
    expect(b.missing).toEqual(['Elevator or ground-floor units']);
  });
  it('missing contact', () => {
    const b = accommodationBadge(info({ accommodationContact: undefined }));
    expect(b.friendly).toBe(false);
    expect(b.missing).toEqual(['Named accommodation contact']);
  });
  it('missing process', () => {
    const b = accommodationBadge(info({ accommodationProcess: undefined }));
    expect(b.friendly).toBe(false);
    expect(b.missing).toEqual(['Written accommodation process']);
  });
  it('service animals not allowed', () => {
    const b = accommodationBadge(
      info({ assistanceAnimals: { serviceAnimalsAllowed: false, esaAllowed: false, noFees: true } }),
    );
    expect(b.friendly).toBe(false);
    expect(b.missing).toEqual(['Service animals allowed with no fees']);
  });
  it('service animals allowed but fees charged', () => {
    const b = accommodationBadge(
      info({ assistanceAnimals: { serviceAnimalsAllowed: true, esaAllowed: true, noFees: false } }),
    );
    expect(b.friendly).toBe(false);
    expect(b.missing).toEqual(['Service animals allowed with no fees']);
  });
  it('reasons and missing partition the five criteria', () => {
    const b = accommodationBadge(info({ features: [], accommodationContact: undefined }));
    expect(b.reasons.length + b.missing.length).toBe(5);
    expect(b.reasons).toEqual(['Written accommodation process', 'Service animals allowed with no fees']);
  });
});
