import { describe, expect, it } from 'vitest';
import type { AccessibilityInfo, FloorPlan, Property } from '@homed/core';
import { ACCESSIBILITY_FEATURE_LABELS } from '@homed/core';
import {
  ACCESSIBILITY_FEATURES,
  kebab,
  parseAccessibilityForm,
  parseFloorPlanForm,
  parsePhotoForm,
  parsePropertyForm,
  type ParseResult,
} from '../../src/lib/landlord/forms';

const TODAY = '2026-10-19';

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

function ok<T>(r: ParseResult<T>): T {
  if (!r.ok) throw new Error(`expected ok, got: ${r.message}`);
  return r.value;
}

function fail(r: ParseResult<unknown>): string {
  if (r.ok) throw new Error('expected a validation failure');
  return r.message;
}

const PROPERTY_FIELDS = {
  name: 'Rugby Road Lofts',
  address: '1 Rugby Rd, Charlottesville, VA',
  lat: '38.03',
  lng: '-78.5',
  kind: 'apartment_complex',
  neighborhood: 'Rugby Road',
  yearBuilt: '1998',
  yearRenovated: '2022',
  website: 'https://example.com',
  noiseLevel: 'quiet',
  parkingMonthly: '85',
  amenity_gym: 'on',
  amenity_parkingAvailable: 'on',
  busRoutes: 'UTS Northline, CAT 7\nCAT 7',
  onBusRoute: 'on',
  litRouteToGrounds: 'on',
  studyAbroadFriendly: 'on',
};

function propertyFields(overrides: Record<string, string | string[] | undefined> = {}): FormData {
  const merged: Record<string, string | string[]> = { ...PROPERTY_FIELDS };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete merged[k];
    else merged[k] = v;
  }
  return form(merged);
}

describe('kebab', () => {
  it('makes URL-safe slugs', () => {
    expect(kebab('Rugby Road Lofts!')).toBe('rugby-road-lofts');
    expect(kebab('  Café  Lofts ')).toBe('cafe-lofts');
    expect(kebab('!!!')).toBe('');
  });
});

describe('parsePropertyForm', () => {
  it('parses a full property with the portal source and a derived slug', () => {
    const v = ok(parsePropertyForm(propertyFields(), 'L1', TODAY));
    expect(v).not.toHaveProperty('id');
    expect(v).toMatchObject({
      slug: 'rugby-road-lofts',
      name: 'Rugby Road Lofts',
      address: '1 Rugby Rd, Charlottesville, VA',
      location: { lat: 38.03, lng: -78.5 },
      kind: 'apartment_complex',
      onGrounds: false,
      neighborhood: 'Rugby Road',
      landlordId: 'L1',
      yearBuilt: 1998,
      yearRenovated: 2022,
      website: 'https://example.com',
      noiseLevel: 'quiet',
      onBusRoute: true,
      litRouteToGrounds: true,
      studyAbroadFriendly: true,
      noGuarantorOption: false,
      gradHeavy: false,
      source: 'landlord portal',
      dataStatus: 'unverified_seed',
      lastVerified: TODAY,
    });
    expect(v.amenities).toEqual({
      gym: true,
      studyRooms: false,
      rooftop: false,
      pool: false,
      elevator: false,
      parkingAvailable: true,
      petsAllowed: false,
      parkingMonthly: 85,
    });
    expect(v.busRoutes).toEqual(['UTS Northline', 'CAT 7']);
  });

  it('keeps id and dataStatus from the existing record and uses an explicit slug', () => {
    const existing = { id: 'P9', dataStatus: 'verified' } as Property;
    const v = ok(parsePropertyForm(propertyFields({ slug: 'My Custom Slug!!' }), 'L1', TODAY, existing));
    expect(v.id).toBe('P9');
    expect(v.dataStatus).toBe('verified');
    expect(v.slug).toBe('my-custom-slug');
  });

  it('omits optional fields left blank', () => {
    const v = ok(parsePropertyForm(propertyFields({ website: '', noiseLevel: '', parkingMonthly: '', yearBuilt: '', yearRenovated: '', busRoutes: '' }), 'L1', TODAY));
    expect(v).not.toHaveProperty('website');
    expect(v).not.toHaveProperty('noiseLevel');
    expect(v).not.toHaveProperty('yearBuilt');
    expect(v.amenities).not.toHaveProperty('parkingMonthly');
    expect(v.busRoutes).toEqual([]);
  });

  it('rejects a missing name', () => {
    expect(fail(parsePropertyForm(propertyFields({ name: '' }), 'L1', TODAY))).toBe('Name is required');
  });

  it('rejects a name with no letters or digits when no slug is given', () => {
    expect(fail(parsePropertyForm(propertyFields({ name: '!!!' }), 'L1', TODAY))).toBe(
      'Slug needs at least one letter or number',
    );
  });

  it('rejects a missing address and neighborhood', () => {
    expect(fail(parsePropertyForm(propertyFields({ address: '' }), 'L1', TODAY))).toBe('Address is required');
    expect(fail(parsePropertyForm(propertyFields({ neighborhood: undefined }), 'L1', TODAY))).toBe(
      'Neighborhood is required',
    );
  });

  it('rejects latitude and longitude that are blank, non-numeric, or out of range', () => {
    expect(fail(parsePropertyForm(propertyFields({ lat: '' }), 'L1', TODAY))).toBe('Latitude is required');
    expect(fail(parsePropertyForm(propertyFields({ lat: 'north' }), 'L1', TODAY))).toBe('Latitude must be a number');
    expect(fail(parsePropertyForm(propertyFields({ lat: '95' }), 'L1', TODAY))).toBe('Latitude must be between -90 and 90');
    expect(fail(parsePropertyForm(propertyFields({ lng: '-181' }), 'L1', TODAY))).toBe(
      'Longitude must be between -180 and 180',
    );
  });

  it('rejects on_grounds and unknown property types', () => {
    expect(fail(parsePropertyForm(propertyFields({ kind: 'on_grounds' }), 'L1', TODAY))).toBe(
      'Property type is not a valid choice',
    );
    expect(fail(parsePropertyForm(propertyFields({ kind: '' }), 'L1', TODAY))).toBe('Property type is required');
  });

  it('rejects renovation before construction and non-integer years', () => {
    expect(fail(parsePropertyForm(propertyFields({ yearRenovated: '1990' }), 'L1', TODAY))).toBe(
      'Year renovated cannot be before year built',
    );
    expect(fail(parsePropertyForm(propertyFields({ yearBuilt: '1998.5' }), 'L1', TODAY))).toBe(
      'Year built must be a whole number',
    );
    expect(fail(parsePropertyForm(propertyFields({ yearBuilt: '1700' }), 'L1', TODAY))).toBe(
      'Year built must be between 1800 and 2100',
    );
  });

  it('rejects non-http website URLs', () => {
    expect(fail(parsePropertyForm(propertyFields({ website: 'ftp://example.com' }), 'L1', TODAY))).toBe(
      'Website must start with http:// or https://',
    );
    expect(fail(parsePropertyForm(propertyFields({ website: 'not a url' }), 'L1', TODAY))).toBe(
      'Website must be a full URL starting with http:// or https://',
    );
  });

  it('rejects unknown noise levels and bad parking costs', () => {
    expect(fail(parsePropertyForm(propertyFields({ noiseLevel: 'loud' }), 'L1', TODAY))).toBe(
      'Noise level is not a valid choice',
    );
    expect(fail(parsePropertyForm(propertyFields({ parkingMonthly: '-5' }), 'L1', TODAY))).toBe(
      'Parking cost must be between 0 and 5000',
    );
  });
});

const FLOOR_PLAN_FIELDS = {
  name: '4BR / 4BA',
  beds: '4',
  baths: '4',
  sqft: '1500',
  rentAmount: '1450',
  rentBasis: 'per_bed',
  leaseStart: '2026-08-15',
  leaseEnd: '2027-05-15',
  termKind: 'academic_year',
  leaseType: 'individual',
  furnished: 'on',
  utilitiesIncluded: 'on',
  internetIncluded: 'on',
  inUnitLaundry: 'on',
  dishwasher: 'on',
  ac: 'on',
  unitsAvailable: '5',
  totalUnits: '12',
  furnitureMonthly: '60',
  applicationFee: '50',
  screeningCost: '35',
  applicationDeposit: '250',
  securityDeposit: '500',
  floorPlanImageUrl: 'https://example.com/plan.png',
};

function floorPlanFields(overrides: Record<string, string | undefined> = {}): FormData {
  const merged: Record<string, string> = { ...FLOOR_PLAN_FIELDS };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete merged[k];
    else merged[k] = v;
  }
  return form(merged);
}

describe('parseFloorPlanForm', () => {
  it('parses every floor plan field and stamps lastVerified', () => {
    const v = ok(parseFloorPlanForm(floorPlanFields(), 'P1', TODAY));
    expect(v).not.toHaveProperty('id');
    expect(v).toMatchObject({
      propertyId: 'P1',
      name: '4BR / 4BA',
      beds: 4,
      baths: 4,
      sqft: 1500,
      rentAmount: 1450,
      rentBasis: 'per_bed',
      leaseStart: '2026-08-15',
      leaseEnd: '2027-05-15',
      termKind: 'academic_year',
      leaseType: 'individual',
      furnished: true,
      furnitureMonthly: 60,
      utilitiesIncluded: true,
      internetIncluded: true,
      inUnitLaundry: true,
      dishwasher: true,
      ac: true,
      unitsAvailable: 5,
      totalUnits: 12,
      applicationFee: 50,
      screeningCost: 35,
      applicationDeposit: 250,
      securityDeposit: 500,
      floorPlanImageUrl: 'https://example.com/plan.png',
      lastVerified: TODAY,
    });
  });

  it('blank units means unknown (null); unchecked boxes are false; existing id is kept', () => {
    const existing = { id: 'F7' } as FloorPlan;
    const v = ok(
      parseFloorPlanForm(
        floorPlanFields({ unitsAvailable: '', furnished: undefined, ac: undefined, totalUnits: undefined, applicationFee: undefined }),
        'P1',
        TODAY,
        existing,
      ),
    );
    expect(v.id).toBe('F7');
    expect(v.unitsAvailable).toBeNull();
    expect(v.furnished).toBe(false);
    expect(v.ac).toBe(false);
    expect(v).not.toHaveProperty('totalUnits');
    expect(v).not.toHaveProperty('applicationFee');
  });

  it('a fee over the Virginia cap is saved (warnings are shown separately)', () => {
    const v = ok(parseFloorPlanForm(floorPlanFields({ applicationFee: '75' }), 'P1', TODAY));
    expect(v.applicationFee).toBe(75);
  });

  it('rejects a missing name and missing rent', () => {
    expect(fail(parseFloorPlanForm(floorPlanFields({ name: '' }), 'P1', TODAY))).toBe('Floor plan name is required');
    expect(fail(parseFloorPlanForm(floorPlanFields({ rentAmount: '' }), 'P1', TODAY))).toBe('Rent is required');
  });

  it('rejects negative or fractional rent', () => {
    expect(fail(parseFloorPlanForm(floorPlanFields({ rentAmount: '-1' }), 'P1', TODAY))).toBe(
      'Rent must be between 0 and 100000',
    );
    expect(fail(parseFloorPlanForm(floorPlanFields({ rentAmount: '1450.5' }), 'P1', TODAY))).toBe(
      'Rent must be a whole number',
    );
  });

  it('rejects fractional bedrooms and bathrooms that are not halves', () => {
    expect(fail(parseFloorPlanForm(floorPlanFields({ beds: '2.5' }), 'P1', TODAY))).toBe('Bedrooms must be a whole number');
    expect(fail(parseFloorPlanForm(floorPlanFields({ baths: '4.25' }), 'P1', TODAY))).toBe(
      'Bathrooms must be a multiple of 0.5',
    );
    expect(ok(parseFloorPlanForm(floorPlanFields({ baths: '2.5' }), 'P1', TODAY)).baths).toBe(2.5);
  });

  it('rejects a lease end on or before the lease start', () => {
    expect(fail(parseFloorPlanForm(floorPlanFields({ leaseEnd: '2026-08-15' }), 'P1', TODAY))).toBe(
      'Lease end must be after lease start',
    );
  });

  it('rejects impossible or missing dates', () => {
    expect(fail(parseFloorPlanForm(floorPlanFields({ leaseStart: '2026-02-30' }), 'P1', TODAY))).toBe(
      'Lease start must be a date (YYYY-MM-DD)',
    );
    expect(fail(parseFloorPlanForm(floorPlanFields({ leaseEnd: '08/15/2027' }), 'P1', TODAY))).toBe(
      'Lease end must be a date (YYYY-MM-DD)',
    );
    expect(fail(parseFloorPlanForm(floorPlanFields({ leaseStart: '' }), 'P1', TODAY))).toBe('Lease start is required');
  });

  it('rejects unknown enum values', () => {
    expect(fail(parseFloorPlanForm(floorPlanFields({ termKind: 'monthly' }), 'P1', TODAY))).toBe(
      'Lease term is not a valid choice',
    );
    expect(fail(parseFloorPlanForm(floorPlanFields({ rentBasis: '' }), 'P1', TODAY))).toBe('Rent basis is required');
    expect(fail(parseFloorPlanForm(floorPlanFields({ leaseType: 'shared' }), 'P1', TODAY))).toBe(
      'Lease type is not a valid choice',
    );
  });

  it('rejects availability above total units and negative counts', () => {
    expect(fail(parseFloorPlanForm(floorPlanFields({ unitsAvailable: '13' }), 'P1', TODAY))).toBe(
      'Units available cannot exceed total units',
    );
    expect(fail(parseFloorPlanForm(floorPlanFields({ unitsAvailable: '-1' }), 'P1', TODAY))).toBe(
      'Units available must be between 0 and 1000',
    );
  });

  it('rejects non-numeric fees and non-http floor plan images', () => {
    expect(fail(parseFloorPlanForm(floorPlanFields({ applicationFee: 'fifty' }), 'P1', TODAY))).toBe(
      'Application fee must be a number',
    );
    expect(fail(parseFloorPlanForm(floorPlanFields({ floorPlanImageUrl: 'javascript:alert(1)' }), 'P1', TODAY))).toBe(
      'Floor plan image must start with http:// or https://',
    );
  });
});

describe('parseAccessibilityForm', () => {
  it('ACCESSIBILITY_FEATURES lists every feature with a label', () => {
    expect([...ACCESSIBILITY_FEATURES].sort()).toEqual(Object.keys(ACCESSIBILITY_FEATURE_LABELS).sort());
  });

  it('builds the feature checklist, animal policy and contact details', () => {
    const v = ok(
      parseAccessibilityForm(
        form({
          feature_elevator: 'on',
          feature_grab_bars: 'on',
          service_animals_allowed: 'on',
          animal_no_fees: 'on',
          accommodationContact: 'Disability Services, dsc@virginia.edu',
          accommodationProcess: 'Email the office with your request.',
          typicalResponseDays: '3',
        }),
        'P1',
        TODAY,
      ),
    );
    expect(v).toEqual({
      propertyId: 'P1',
      features: ['elevator', 'grab_bars'],
      photoConfirmed: [],
      accommodationContact: 'Disability Services, dsc@virginia.edu',
      accommodationProcess: 'Email the office with your request.',
      typicalResponseDays: 3,
      assistanceAnimals: { serviceAnimalsAllowed: true, esaAllowed: false, noFees: true },
      updatedAt: TODAY,
    } satisfies AccessibilityInfo);
  });

  it('keeps photo confirmations only for features still checked', () => {
    const existing: AccessibilityInfo = {
      propertyId: 'P1',
      features: ['elevator', 'grab_bars'],
      photoConfirmed: ['elevator', 'grab_bars'],
      assistanceAnimals: { serviceAnimalsAllowed: false, esaAllowed: false, noFees: false },
      updatedAt: '2026-01-01',
    };
    const v = ok(parseAccessibilityForm(form({ feature_elevator: 'on' }), 'P1', TODAY, existing));
    expect(v.photoConfirmed).toEqual(['elevator']);
    expect(v.features).toEqual(['elevator']);
  });

  it('an empty form is valid and produces no features', () => {
    const v = ok(parseAccessibilityForm(form({}), 'P1', TODAY));
    expect(v.features).toEqual([]);
    expect(v).not.toHaveProperty('accommodationContact');
    expect(v).not.toHaveProperty('typicalResponseDays');
  });

  it('rejects out-of-range response days and over-long text', () => {
    expect(fail(parseAccessibilityForm(form({ typicalResponseDays: '-1' }), 'P1', TODAY))).toBe(
      'Typical response time must be between 0 and 365',
    );
    expect(fail(parseAccessibilityForm(form({ typicalResponseDays: '2.5' }), 'P1', TODAY))).toBe(
      'Typical response time must be a whole number',
    );
    expect(fail(parseAccessibilityForm(form({ accommodationContact: 'x'.repeat(201) }), 'P1', TODAY))).toBe(
      'Accommodation contact must be 200 characters or fewer',
    );
    expect(fail(parseAccessibilityForm(form({ accommodationProcess: 'x'.repeat(2001) }), 'P1', TODAY))).toBe(
      'Accommodation process must be 2000 characters or fewer',
    );
  });
});

describe('parsePhotoForm', () => {
  it('parses a photo with the rendering flag and credit', () => {
    const v = ok(
      parsePhotoForm(
        form({
          url: 'https://upload.wikimedia.org/front.jpg',
          alt: 'Front of the building',
          isRendering: 'on',
          credit: 'Wikimedia Commons, CC BY-SA 4.0',
          floorPlanId: 'F1',
        }),
        'P1',
      ),
    );
    expect(v).toEqual({
      propertyId: 'P1',
      url: 'https://upload.wikimedia.org/front.jpg',
      alt: 'Front of the building',
      isRendering: true,
      credit: 'Wikimedia Commons, CC BY-SA 4.0',
      floorPlanId: 'F1',
    });
  });

  it('isRendering defaults to false and optional fields are omitted when blank', () => {
    const v = ok(parsePhotoForm(form({ url: 'http://example.com/a.jpg', alt: 'Kitchen' }), 'P1'));
    expect(v.isRendering).toBe(false);
    expect(v).not.toHaveProperty('credit');
    expect(v).not.toHaveProperty('floorPlanId');
  });

  it('rejects a missing URL and non-http(s) URLs', () => {
    expect(fail(parsePhotoForm(form({ alt: 'x' }), 'P1'))).toBe('Image URL is required');
    expect(fail(parsePhotoForm(form({ url: 'notaurl', alt: 'x' }), 'P1'))).toBe(
      'Image URL must be a full URL starting with http:// or https://',
    );
    expect(fail(parsePhotoForm(form({ url: 'ftp://example.com/a.jpg', alt: 'x' }), 'P1'))).toBe(
      'Image URL must start with http:// or https://',
    );
  });

  it('requires alt text and caps its length', () => {
    expect(fail(parsePhotoForm(form({ url: 'https://example.com/a.jpg' }), 'P1'))).toBe('Alt text is required');
    expect(fail(parsePhotoForm(form({ url: 'https://example.com/a.jpg', alt: 'x'.repeat(301) }), 'P1'))).toBe(
      'Alt text must be 300 characters or fewer',
    );
  });
});
