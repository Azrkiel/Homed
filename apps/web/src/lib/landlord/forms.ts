// Pure parsers: landlord portal FormData -> typed catalog inputs. No I/O, no repo calls.
// Checkbox convention: a checked box posts 'on'; absent means false.
// Money is whole US dollars per month. Dates are ISO YYYY-MM-DD and come in as `today` (no clock here).
import type {
  AccessibilityFeature,
  AccessibilityInfo,
  FloorPlan,
  ID,
  ISODate,
  LeaseTermKind,
  LeaseType,
  NoiseLevel,
  Photo,
  Property,
  PropertyAmenities,
  PropertyKind,
} from '@homed/core';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export type PropertyInput = Omit<Property, 'id'> & { id?: ID };
export type FloorPlanInput = Omit<FloorPlan, 'id'> & { id?: ID };
export type PhotoInput = Omit<Photo, 'id' | 'looksRating' | 'ratingCount'> & { id?: ID };

/** Every AccessibilityFeature, in checklist order. Test keeps this in sync with ACCESSIBILITY_FEATURE_LABELS. */
/** Property.source for listings a landlord created in the portal. */
export const LANDLORD_SOURCE = 'landlord portal';

export const ACCESSIBILITY_FEATURES: readonly AccessibilityFeature[] = [
  'step_free_entrance',
  'elevator',
  'ground_floor_units',
  'wide_doorways',
  'roll_in_shower',
  'grab_bars',
  'flashing_alarms',
  'quiet_units',
  'private_bathroom',
  'kitchen_access',
  'gender_inclusive_units',
  'kosher_halal_kitchen',
];

const AMENITY_KEYS = ['gym', 'studyRooms', 'rooftop', 'pool', 'elevator', 'parkingAvailable', 'petsAllowed'] as const;
const PROPERTY_KINDS: readonly PropertyKind[] = ['apartment_complex', 'house'];
const NOISE_LEVELS: readonly NoiseLevel[] = ['quiet', 'moderate', 'social'];
const RENT_BASES = ['per_bed', 'per_unit'] as const;
const TERM_KINDS: readonly LeaseTermKind[] = ['12_month', 'academic_year', 'semester', 'other'];
const LEASE_TYPES: readonly LeaseType[] = ['individual', 'joint'];
const MAX_MONEY = 100_000;

class FormError extends Error {}

function run<T>(fn: () => T): ParseResult<T> {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    if (e instanceof FormError) return { ok: false, message: e.message };
    throw e;
  }
}

function raw(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function flag(fd: FormData, key: string): boolean {
  return fd.get(key) === 'on';
}

function required(fd: FormData, key: string, label: string, max = 200): string {
  const v = raw(fd, key);
  if (!v) throw new FormError(`${label} is required`);
  if (v.length > max) throw new FormError(`${label} must be ${max} characters or fewer`);
  return v;
}

function optionalText(fd: FormData, key: string, label: string, max = 200): string | undefined {
  const v = raw(fd, key);
  if (!v) return undefined;
  if (v.length > max) throw new FormError(`${label} must be ${max} characters or fewer`);
  return v;
}

interface NumRange {
  min: number;
  max: number;
  integer?: boolean;
}

function toNumber(v: string, label: string, r: NumRange): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new FormError(`${label} must be a number`);
  if (r.integer && !Number.isInteger(n)) throw new FormError(`${label} must be a whole number`);
  if (n < r.min || n > r.max) throw new FormError(`${label} must be between ${r.min} and ${r.max}`);
  return n;
}

function num(fd: FormData, key: string, label: string, r: NumRange): number {
  const v = raw(fd, key);
  if (!v) throw new FormError(`${label} is required`);
  return toNumber(v, label, r);
}

function optionalNum(fd: FormData, key: string, label: string, r: NumRange): number | undefined {
  const v = raw(fd, key);
  return v ? toNumber(v, label, r) : undefined;
}

function money(fd: FormData, key: string, label: string): number {
  return num(fd, key, label, { min: 0, max: MAX_MONEY, integer: true });
}

function optionalMoney(fd: FormData, key: string, label: string): number | undefined {
  return optionalNum(fd, key, label, { min: 0, max: MAX_MONEY, integer: true });
}

function choice<T extends string>(v: string, allowed: readonly T[], label: string): T {
  if (!(allowed as readonly string[]).includes(v)) throw new FormError(`${label} is not a valid choice`);
  return v as T;
}

function requiredChoice<T extends string>(fd: FormData, key: string, label: string, allowed: readonly T[]): T {
  const v = raw(fd, key);
  if (!v) throw new FormError(`${label} is required`);
  return choice(v, allowed, label);
}

function optionalChoice<T extends string>(fd: FormData, key: string, label: string, allowed: readonly T[]): T | undefined {
  const v = raw(fd, key);
  return v ? choice(v, allowed, label) : undefined;
}

function isoDate(fd: FormData, key: string, label: string): ISODate {
  const v = raw(fd, key);
  if (!v) throw new FormError(`${label} is required`);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T00:00:00Z`) : Number.NaN;
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v) {
    throw new FormError(`${label} must be a date (YYYY-MM-DD)`);
  }
  return v;
}

function httpUrl(v: string, label: string): string {
  if (v.length > 2000) throw new FormError(`${label} is too long`);
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new FormError(`${label} must be a full URL starting with http:// or https://`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FormError(`${label} must start with http:// or https://`);
  }
  return v;
}

function optionalUrl(fd: FormData, key: string, label: string): string | undefined {
  const v = raw(fd, key);
  return v ? httpUrl(v, label) : undefined;
}

/** URL-safe slug: "Rugby Road Lofts!" -> "rugby-road-lofts". Uniqueness is the repo's job. */
export function kebab(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Comma- or newline-separated names, trimmed, empties and duplicates dropped. */
function list(v: string): string[] {
  return [...new Set(v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))];
}

export function parsePropertyForm(
  fd: FormData,
  landlordId: ID,
  today: ISODate,
  existing?: Property,
): ParseResult<PropertyInput> {
  return run(() => {
    const name = required(fd, 'name', 'Name');
    const slug = kebab(raw(fd, 'slug') || name);
    if (!slug) throw new FormError('Slug needs at least one letter or number');

    const yearBuilt = optionalNum(fd, 'yearBuilt', 'Year built', { min: 1800, max: 2100, integer: true });
    const yearRenovated = optionalNum(fd, 'yearRenovated', 'Year renovated', { min: 1800, max: 2100, integer: true });
    if (yearBuilt !== undefined && yearRenovated !== undefined && yearRenovated < yearBuilt) {
      throw new FormError('Year renovated cannot be before year built');
    }

    const amenities = {} as PropertyAmenities;
    for (const key of AMENITY_KEYS) amenities[key] = flag(fd, `amenity_${key}`);
    const parkingMonthly = optionalNum(fd, 'parkingMonthly', 'Parking cost', { min: 0, max: 5000, integer: true });
    if (parkingMonthly !== undefined) amenities.parkingMonthly = parkingMonthly;

    // Start from the stored record so fields this form doesn't show (on-Grounds details, the original
    // source of a seeded property, and anything added later) survive an edit.
    const value: PropertyInput = {
      ...(existing ? structuredClone(existing) : {}),
      slug,
      name,
      address: required(fd, 'address', 'Address'),
      location: {
        lat: num(fd, 'lat', 'Latitude', { min: -90, max: 90 }),
        lng: num(fd, 'lng', 'Longitude', { min: -180, max: 180 }),
      },
      kind: existing?.kind === 'on_grounds' ? 'on_grounds' : requiredChoice(fd, 'kind', 'Property type', PROPERTY_KINDS),
      onGrounds: existing?.onGrounds ?? false,
      neighborhood: required(fd, 'neighborhood', 'Neighborhood'),
      landlordId,
      amenities,
      onBusRoute: flag(fd, 'onBusRoute'),
      busRoutes: list(raw(fd, 'busRoutes')),
      studyAbroadFriendly: flag(fd, 'studyAbroadFriendly'),
      noGuarantorOption: flag(fd, 'noGuarantorOption'),
      gradHeavy: flag(fd, 'gradHeavy'),
      litRouteToGrounds: flag(fd, 'litRouteToGrounds'),
      source: existing?.source ?? LANDLORD_SOURCE,
      dataStatus: existing?.dataStatus ?? 'unverified_seed',
      lastVerified: today,
    };
    // Optional fields the form shows: a blank input clears the stored value.
    delete value.yearBuilt;
    delete value.yearRenovated;
    delete value.website;
    delete value.noiseLevel;
    if (yearBuilt !== undefined) value.yearBuilt = yearBuilt;
    if (yearRenovated !== undefined) value.yearRenovated = yearRenovated;
    const website = optionalUrl(fd, 'website', 'Website');
    if (website !== undefined) value.website = website;
    const noise = optionalChoice(fd, 'noiseLevel', 'Noise level', NOISE_LEVELS);
    if (noise !== undefined) value.noiseLevel = noise;
    return value;
  });
}

export function parseFloorPlanForm(
  fd: FormData,
  propertyId: ID,
  today: ISODate,
  existing?: FloorPlan,
): ParseResult<FloorPlanInput> {
  return run(() => {
    const baths = num(fd, 'baths', 'Bathrooms', { min: 0, max: 20 });
    if ((baths * 2) % 1 !== 0) throw new FormError('Bathrooms must be a multiple of 0.5');
    const leaseStart = isoDate(fd, 'leaseStart', 'Lease start');
    const leaseEnd = isoDate(fd, 'leaseEnd', 'Lease end');
    if (leaseEnd <= leaseStart) throw new FormError('Lease end must be after lease start');

    const unitsRaw = raw(fd, 'unitsAvailable');
    const unitsAvailable = unitsRaw ? toNumber(unitsRaw, 'Units available', { min: 0, max: 1000, integer: true }) : null;
    const totalUnits = optionalNum(fd, 'totalUnits', 'Total units', { min: 1, max: 1000, integer: true });
    if (totalUnits !== undefined && unitsAvailable !== null && unitsAvailable > totalUnits) {
      throw new FormError('Units available cannot exceed total units');
    }

    const value: FloorPlanInput = {
      ...(existing ? { id: existing.id } : {}),
      propertyId,
      name: required(fd, 'name', 'Floor plan name'),
      beds: num(fd, 'beds', 'Bedrooms', { min: 0, max: 20, integer: true }),
      baths,
      rentAmount: money(fd, 'rentAmount', 'Rent'),
      rentBasis: requiredChoice(fd, 'rentBasis', 'Rent basis', RENT_BASES),
      leaseStart,
      leaseEnd,
      termKind: requiredChoice(fd, 'termKind', 'Lease term', TERM_KINDS),
      leaseType: requiredChoice(fd, 'leaseType', 'Lease type', LEASE_TYPES),
      furnished: flag(fd, 'furnished'),
      utilitiesIncluded: flag(fd, 'utilitiesIncluded'),
      internetIncluded: flag(fd, 'internetIncluded'),
      inUnitLaundry: flag(fd, 'inUnitLaundry'),
      dishwasher: flag(fd, 'dishwasher'),
      ac: flag(fd, 'ac'),
      unitsAvailable,
      lastVerified: today,
    };
    const sqft = optionalNum(fd, 'sqft', 'Square feet', { min: 1, max: 100_000, integer: true });
    if (sqft !== undefined) value.sqft = sqft;
    if (totalUnits !== undefined) value.totalUnits = totalUnits;
    const furnitureMonthly = optionalMoney(fd, 'furnitureMonthly', 'Furniture rental');
    if (furnitureMonthly !== undefined) value.furnitureMonthly = furnitureMonthly;
    const utilitiesEstimate = optionalMoney(fd, 'utilitiesEstimate', 'Utilities estimate');
    if (utilitiesEstimate !== undefined) value.utilitiesEstimate = utilitiesEstimate;
    const internetEstimate = optionalMoney(fd, 'internetEstimate', 'Internet estimate');
    if (internetEstimate !== undefined) value.internetEstimate = internetEstimate;
    const applicationFee = optionalMoney(fd, 'applicationFee', 'Application fee');
    if (applicationFee !== undefined) value.applicationFee = applicationFee;
    const screeningCost = optionalMoney(fd, 'screeningCost', 'Screening cost');
    if (screeningCost !== undefined) value.screeningCost = screeningCost;
    const applicationDeposit = optionalMoney(fd, 'applicationDeposit', 'Application deposit');
    if (applicationDeposit !== undefined) value.applicationDeposit = applicationDeposit;
    const securityDeposit = optionalMoney(fd, 'securityDeposit', 'Security deposit');
    if (securityDeposit !== undefined) value.securityDeposit = securityDeposit;
    const imageUrl = optionalUrl(fd, 'floorPlanImageUrl', 'Floor plan image');
    if (imageUrl !== undefined) value.floorPlanImageUrl = imageUrl;
    return value;
  });
}

export function parseAccessibilityForm(
  fd: FormData,
  propertyId: ID,
  today: ISODate,
  existing?: AccessibilityInfo,
): ParseResult<AccessibilityInfo> {
  return run(() => {
    const features = ACCESSIBILITY_FEATURES.filter((f) => flag(fd, `feature_${f}`));
    // Photo confirmation comes from the photo review, never from this form. Keep what is still checked.
    const photoConfirmed = existing ? existing.photoConfirmed.filter((f) => features.includes(f)) : [];
    const value: AccessibilityInfo = {
      propertyId,
      features,
      photoConfirmed,
      assistanceAnimals: {
        serviceAnimalsAllowed: flag(fd, 'service_animals_allowed'),
        esaAllowed: flag(fd, 'esa_allowed'),
        noFees: flag(fd, 'animal_no_fees'),
      },
      updatedAt: today,
    };
    const contact = optionalText(fd, 'accommodationContact', 'Accommodation contact', 200);
    if (contact !== undefined) value.accommodationContact = contact;
    const process = optionalText(fd, 'accommodationProcess', 'Accommodation process', 2000);
    if (process !== undefined) value.accommodationProcess = process;
    const days = optionalNum(fd, 'typicalResponseDays', 'Typical response time', { min: 0, max: 365, integer: true });
    if (days !== undefined) value.typicalResponseDays = days;
    return value;
  });
}

export function parsePhotoForm(fd: FormData, propertyId: ID): ParseResult<PhotoInput> {
  return run(() => {
    const value: PhotoInput = {
      propertyId,
      url: httpUrl(required(fd, 'url', 'Image URL', 2000), 'Image URL'),
      alt: required(fd, 'alt', 'Alt text', 300),
      isRendering: flag(fd, 'isRendering'),
    };
    // The caller must check that this floor plan belongs to propertyId; the repo does not.
    const floorPlanId = optionalText(fd, 'floorPlanId', 'Floor plan', 100);
    if (floorPlanId !== undefined) value.floorPlanId = floorPlanId;
    const credit = optionalText(fd, 'credit', 'Credit', 200);
    if (credit !== undefined) value.credit = credit;
    return value;
  });
}
