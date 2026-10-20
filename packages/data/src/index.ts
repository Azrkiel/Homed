// @homed/data: the hand-curated catalog. CONTRACT (Phase 0): SeedData's shape and the loader
// signatures are fixed. Phase 1 replaces the JSON under seed/ with the real dataset.
//
// seed/      the dataset the app runs on (Phase 1 owns it)
// fixtures/  a tiny stable dataset for tests in other packages (lead owns it; never edit in a phase)

import type {
  AccessibilityInfo,
  Building,
  FloorPlan,
  Landlord,
  Landmark,
  Major,
  Photo,
  Property,
  Section,
  WalkTime,
} from '@homed/core';

import seedMeta from '../seed/meta.json';
import seedBuildings from '../seed/buildings.json';
import seedLandmarks from '../seed/landmarks.json';
import seedMajors from '../seed/majors.json';
import seedLandlords from '../seed/landlords.json';
import seedProperties from '../seed/properties.json';
import seedFloorPlans from '../seed/floor_plans.json';
import seedPhotos from '../seed/photos.json';
import seedAccessibility from '../seed/accessibility.json';
import seedWalkTimes from '../seed/walk_times.json';
import seedSections from '../seed/sections.json';

import fxMeta from '../fixtures/meta.json';
import fxBuildings from '../fixtures/buildings.json';
import fxLandmarks from '../fixtures/landmarks.json';
import fxMajors from '../fixtures/majors.json';
import fxLandlords from '../fixtures/landlords.json';
import fxProperties from '../fixtures/properties.json';
import fxFloorPlans from '../fixtures/floor_plans.json';
import fxPhotos from '../fixtures/photos.json';
import fxAccessibility from '../fixtures/accessibility.json';
import fxWalkTimes from '../fixtures/walk_times.json';
import fxSections from '../fixtures/sections.json';

export interface SeedMeta {
  version: string;
  /** ISO date the dataset was assembled. */
  generatedAt: string;
  /** Plain-language note on provenance, shown on the About page. */
  notes: string;
}

export interface SeedData {
  meta: SeedMeta;
  buildings: Building[];
  landmarks: Landmark[];
  majors: Major[];
  landlords: Landlord[];
  properties: Property[];
  floorPlans: FloorPlan[];
  photos: Photo[];
  accessibility: AccessibilityInfo[];
  walkTimes: WalkTime[];
  sections: Section[];
}

/** The real dataset under seed/. */
export function loadSeed(): SeedData {
  return {
    meta: seedMeta as SeedMeta,
    buildings: seedBuildings as Building[],
    landmarks: seedLandmarks as Landmark[],
    majors: seedMajors as Major[],
    landlords: seedLandlords as Landlord[],
    properties: seedProperties as Property[],
    floorPlans: seedFloorPlans as FloorPlan[],
    photos: seedPhotos as Photo[],
    accessibility: seedAccessibility as AccessibilityInfo[],
    walkTimes: seedWalkTimes as WalkTime[],
    sections: seedSections as Section[],
  };
}

/** The tiny stable test dataset under fixtures/. */
export function loadFixture(): SeedData {
  return {
    meta: fxMeta as SeedMeta,
    buildings: fxBuildings as Building[],
    landmarks: fxLandmarks as Landmark[],
    majors: fxMajors as Major[],
    landlords: fxLandlords as Landlord[],
    properties: fxProperties as Property[],
    floorPlans: fxFloorPlans as FloorPlan[],
    photos: fxPhotos as Photo[],
    accessibility: fxAccessibility as AccessibilityInfo[],
    walkTimes: fxWalkTimes as WalkTime[],
    sections: fxSections as Section[],
  };
}
