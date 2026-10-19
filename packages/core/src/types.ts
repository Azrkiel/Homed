// Homed domain types. CONTRACT (Phase 0): every package and app builds on these.
// Changing a type here is a lead-only change; phases report `blocked` instead.
//
// Money is whole US dollars per month unless a field says otherwise.
// Dates are ISO strings: ISODate = "YYYY-MM-DD", ISODateTime = full ISO 8601.

export type ID = string;
export type ISODate = string;
export type ISODateTime = string;

export interface LatLng {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Users and preferences
// ---------------------------------------------------------------------------

export type ClassYear = 'first' | 'second' | 'third' | 'fourth' | 'grad' | 'phd';
export type UserRole = 'student' | 'landlord' | 'admin';

/** Best Match weights. Always normalised so price + location + looks = 1. */
export interface ScoreWeights {
  price: number;
  location: number;
  looks: number;
}

export type WeightPreset = 'balanced' | 'budget_first' | 'close_to_class' | 'nicest_place';

export interface User {
  id: ID;
  /** Students: must end in @virginia.edu. Landlords: any address. */
  email: string;
  name: string;
  role: UserRole;
  classYear?: ClassYear;
  /** UVA school code, e.g. "SEAS", "COMM", "CLAS", "NURS", "LAW", "DARDEN", "BATTEN", "MED". */
  school?: string;
  /** Major id from the majors catalog (packages/data/seed/majors.json). */
  majorId?: ID;
  /** Max all-in monthly cost per person, USD. */
  budgetMax?: number;
  weights: ScoreWeights;
  /** Landmark ids the student wants counted in the location score (gym, Corner, grocery...). */
  extras: ID[];
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Catalog: properties, floor plans, photos, places
// ---------------------------------------------------------------------------

export type PropertyKind = 'apartment_complex' | 'house' | 'on_grounds';
export type LeaseType = 'individual' | 'joint';
export type LeaseTermKind = '12_month' | 'academic_year' | 'semester' | 'other';
export type NoiseLevel = 'quiet' | 'moderate' | 'social';
export type DataStatus = 'verified' | 'unverified_seed';

export type OnGroundsProgram =
  | 'residential_college'
  | 'language_house'
  | 'upperclass_apartment'
  | 'upperclass_hall'
  | 'other';

export interface OnGroundsInfo {
  program: OnGroundsProgram;
  /** Plain-language eligibility, e.g. "Rising 2nd-4th years; application + interview". */
  eligibility: string;
  applicationOpens?: ISODate;
  applicationDeadline?: ISODate;
  /** Housing & Residence Life page for this option. */
  hrlUrl: string;
}

export interface PropertyAmenities {
  gym: boolean;
  studyRooms: boolean;
  rooftop: boolean;
  pool: boolean;
  elevator: boolean;
  parkingAvailable: boolean;
  /** Monthly parking cost per space, USD. 0 = free; undefined = unknown. */
  parkingMonthly?: number;
  petsAllowed: boolean;
}

export interface Property {
  id: ID;
  slug: string;
  name: string;
  address: string;
  location: LatLng;
  kind: PropertyKind;
  onGrounds: boolean;
  /** e.g. "The Corner", "JPA", "Rugby Road", "Fontaine", "Barracks Road", "West Main", "Venable", "Downtown", "On Grounds". */
  neighborhood: string;
  yearBuilt?: number;
  yearRenovated?: number;
  landlordId?: ID;
  website?: string;
  amenities: PropertyAmenities;
  noiseLevel?: NoiseLevel;
  /** Lit main-road walking route to Grounds and the Corner. */
  litRouteToGrounds?: boolean;
  onBusRoute: boolean;
  /** Route names, e.g. ["UTS Northline", "CAT 7"]. */
  busRoutes: string[];
  /** Subletting allowed or a semester-only option exists. */
  studyAbroadFriendly: boolean;
  /** Accepts students without a US guarantor or SSN (international-friendly). */
  noGuarantorOption: boolean;
  /** Mostly graduate / professional students. */
  gradHeavy?: boolean;
  /** Present when onGrounds is true. */
  onGroundsInfo?: OnGroundsInfo;
  /** Where this record came from (URL or "landlord portal"). */
  source: string;
  dataStatus: DataStatus;
  lastVerified: ISODate;
}

export interface FloorPlan {
  id: ID;
  propertyId: ID;
  /** e.g. "4BR / 4BA", "Studio A". */
  name: string;
  /** 0 = studio. */
  beds: number;
  baths: number;
  sqft?: number;
  /** Monthly rent amount, USD. */
  rentAmount: number;
  /** per_bed: rentAmount is already per person. per_unit: split evenly by bedrooms (studio = 1 person). */
  rentBasis: 'per_bed' | 'per_unit';
  leaseStart: ISODate;
  leaseEnd: ISODate;
  termKind: LeaseTermKind;
  leaseType: LeaseType;
  furnished: boolean;
  /** Monthly furniture rental per person when not furnished and the landlord offers it. */
  furnitureMonthly?: number;
  utilitiesIncluded: boolean;
  /** Estimated monthly utilities per person when not included. */
  utilitiesEstimate?: number;
  internetIncluded: boolean;
  /** Estimated monthly internet per person when not included. */
  internetEstimate?: number;
  inUnitLaundry: boolean;
  dishwasher: boolean;
  ac: boolean;
  /** Units (or beds, for per_bed) still available. null = unknown. */
  unitsAvailable: number | null;
  totalUnits?: number;
  /** Nonrefundable application fee per person, USD. */
  applicationFee?: number;
  /** Actual third-party screening cost passed through per person, USD. */
  screeningCost?: number;
  /** Refundable application deposit per person, USD. */
  applicationDeposit?: number;
  securityDeposit?: number;
  /** Floor plan image URL. */
  floorPlanImageUrl?: string;
  lastVerified: ISODate;
}

export interface Photo {
  id: ID;
  propertyId: ID;
  floorPlanId?: ID;
  url: string;
  alt: string;
  /** Architectural rendering, not a real photo. */
  isRendering: boolean;
  /** Attribution / license line for photos that need one (e.g. Wikimedia Commons, CC BY-SA). */
  credit?: string;
  /** Mean student swipe rating 1-5; undefined until rated. */
  looksRating?: number;
  ratingCount: number;
}

export type BuildingKind = 'academic' | 'library' | 'recreation' | 'other';

export interface Building {
  id: ID;
  /** UVA-style short code, e.g. "THN" for Thornton Hall. */
  code: string;
  name: string;
  /** Main entrance coordinate, hand-checked. */
  entrance: LatLng;
  kind: BuildingKind;
}

export type LandmarkKind = 'social' | 'library' | 'dining' | 'gym' | 'grocery' | 'worship' | 'health' | 'other';

export interface Landmark {
  id: ID;
  name: string;
  location: LatLng;
  kind: LandmarkKind;
  /** Religious landmarks: tradition, for the places-of-worship map layer. */
  tradition?: string;
}

export interface MajorBuildingShare {
  buildingId: ID;
  /** Share of weekly class meetings in this building; shares of one major sum to 1. */
  share: number;
}

export interface Major {
  id: ID;
  name: string;
  school: string;
  /** Buildings where this major's second-year courses met in past semesters. */
  buildings: MajorBuildingShare[];
  /** Typical class meetings per week for a second-year in this major. */
  meetingsPerWeek: number;
}

export type TargetKind = 'building' | 'landmark';

export interface WalkTime {
  propertyId: ID;
  targetId: ID;
  targetKind: TargetKind;
  walkMinutes: number;
  /** Door-to-door bus minutes incl. walking to/from stops and average wait; null = no useful route. */
  busMinutes: number | null;
  source: 'osrm' | 'estimate';
}

/** Lookup into the precomputed walk-time matrix. */
export type WalkLookup = (propertyId: ID, targetId: ID) => WalkTime | undefined;

// ---------------------------------------------------------------------------
// Accessibility and accommodations
// ---------------------------------------------------------------------------

export type AccessibilityFeature =
  | 'step_free_entrance'
  | 'elevator'
  | 'ground_floor_units'
  | 'wide_doorways'
  | 'roll_in_shower'
  | 'grab_bars'
  | 'flashing_alarms'
  | 'quiet_units'
  | 'private_bathroom'
  | 'kitchen_access'
  | 'gender_inclusive_units'
  | 'kosher_halal_kitchen';

export interface AccessibilityInfo {
  propertyId: ID;
  features: AccessibilityFeature[];
  /** Subset of features confirmed by photos. */
  photoConfirmed: AccessibilityFeature[];
  accommodationContact?: string;
  /** Written process for requesting an accommodation. */
  accommodationProcess?: string;
  typicalResponseDays?: number;
  assistanceAnimals: {
    serviceAnimalsAllowed: boolean;
    esaAllowed: boolean;
    /** No pet fees or pet rent for service or emotional support animals. */
    noFees: boolean;
  };
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Joined listing view: one floor plan with its property. The unit of ranking.
// ---------------------------------------------------------------------------

export interface Listing {
  property: Property;
  floorPlan: FloorPlan;
  /** Property photos plus this floor plan's photos. */
  photos: Photo[];
  accessibility?: AccessibilityInfo;
}

// ---------------------------------------------------------------------------
// Schedules (My Classes)
// ---------------------------------------------------------------------------

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ScheduleEntry {
  id: ID;
  /** e.g. "APMA 2120". */
  courseNumber: string;
  label?: string;
  days: Weekday[];
  /** "HH:MM", 24-hour. */
  start: string;
  end: string;
  buildingId: ID;
}

export interface UserSchedule {
  userId: ID;
  mode: 'major' | 'schedule';
  /** Used in major mode. */
  majorId?: ID;
  /** Used in schedule mode. */
  entries: ScheduleEntry[];
  updatedAt: ISODateTime;
}

/** Optional course catalog (empty until Lou's List / SIS access is confirmed). */
export interface Section {
  id: ID;
  term: string;
  courseNumber: string;
  title?: string;
  days: Weekday[];
  start: string;
  end: string;
  buildingId: ID;
}

/** One weekly trip to a class building, after expanding a schedule or a major. */
export interface WeeklyMeeting {
  buildingId: ID;
  /** Trips per week (major mode can be fractional). */
  perWeek: number;
  /** "HH:MM" of the class start, when known (schedule mode). */
  start?: string;
  day?: Weekday;
}

export interface CommuteSummary {
  /** Total one-way minutes to class across the week, best of walk/bus per trip. */
  weeklyMinutes: number;
  /** Weighted mean one-way minutes per trip. */
  averageMinutes: number;
  /** One-way minutes to the earliest class of the week (schedule mode), else to the most-used building. */
  earliestClassMinutes: number | null;
  /** True when at least one trip uses the bus because it beats walking. */
  usesBus: boolean;
  /** Minutes to each chosen extra landmark. */
  extras: { landmarkId: ID; minutes: number }[];
}

// ---------------------------------------------------------------------------
// Cost, filters, scoring
// ---------------------------------------------------------------------------

export interface CostBreakdown {
  rent: number;
  utilities: number;
  internet: number;
  parking: number;
  furniture: number;
  /** All-in monthly cost per person. */
  totalMonthly: number;
  leaseMonths: number;
  /** totalMonthly x leaseMonths. */
  totalLease: number;
  /** Plain-language caveat, e.g. "10-month lease: plan summer housing separately". */
  note?: string;
}

export interface ListingFilters {
  /** Max all-in monthly cost per person. Hard filter. */
  maxCostPerPerson?: number;
  /** Group size: listing must have exactly this many bedrooms (studio counts as 1). Hard filter. */
  groupSize?: number;
  /** 1:1 bed:bath. */
  privateBathroom?: boolean;
  leaseType?: LeaseType;
  termKind?: LeaseTermKind;
  /** Lease must start on or before this date (August move-in). Hard filter. */
  moveInBy?: ISODate;
  studyAbroadFriendly?: boolean;
  furnished?: boolean;
  utilitiesIncluded?: boolean;
  onBusRoute?: boolean;
  parkingAvailable?: boolean;
  inUnitLaundry?: boolean;
  dishwasher?: boolean;
  ac?: boolean;
  noise?: 'quiet' | 'social';
  litRoute?: boolean;
  petsAllowed?: boolean;
  /** Show only accommodation-friendly listings. */
  accommodationFriendly?: boolean;
  /** Listing must have every one of these accessibility features. */
  accessibilityFeatures?: AccessibilityFeature[];
  noGuarantorNeeded?: boolean;
  /** Gym, study rooms or rooftop. */
  amenityBuilding?: boolean;
  /** 'only' = on-Grounds only, 'exclude' = off-Grounds only. Default: both. */
  onGrounds?: 'only' | 'exclude';
  /** Grad filters. */
  studioOr1Br?: boolean;
  gradHeavy?: boolean;
}

export interface ScoringContext {
  weights: ScoreWeights;
  budgetMax?: number;
  meetings: WeeklyMeeting[];
  extras: ID[];
  walk: WalkLookup;
  /** Median $/bedroom per neighborhood across current listings. */
  neighborhoodMedians: Record<string, number>;
  /** "Today" for freshness rules. */
  today: ISODate;
}

export interface MatchScore {
  /** 0-100, rounded to an integer. */
  total: number;
  price: number;
  location: number;
  looks: number;
  /** 'age_only' when there are no real photos (renderings only) or no ratings yet. */
  looksBasis: 'photos_and_age' | 'age_only';
  /** One-line explanation, e.g. "$40 under budget · 9 min to your classes · renovated 2024". */
  why: string;
  cost: CostBreakdown;
  commute: CommuteSummary;
  badges: ListingBadge[];
}

export type ListingBadge =
  | 'renderings_only'
  | 'stale'
  | 'accommodation_friendly'
  | 'few_left'
  | 'private_bath'
  | 'on_grounds'
  | 'individual_lease';

export interface RankedListing {
  listing: Listing;
  score: MatchScore;
}

// ---------------------------------------------------------------------------
// Saves, swipes, groups, votes
// ---------------------------------------------------------------------------

export interface Save {
  userId: ID;
  floorPlanId: ID;
  note?: string;
  createdAt: ISODateTime;
}

export type SwipeDirection = 'right' | 'left';

export interface Swipe {
  userId: ID;
  floorPlanId: ID;
  direction: SwipeDirection;
  /** Set when swiping in group mode. */
  groupId?: ID;
  createdAt: ISODateTime;
}

export interface Group {
  id: ID;
  name: string;
  ownerId: ID;
  /** Share code used in invite links: /groups/join/<inviteCode>. */
  inviteCode: string;
  createdAt: ISODateTime;
}

export interface GroupMember {
  groupId: ID;
  userId: ID;
  role: 'leader' | 'member';
  /** Per-person max all-in monthly cost. */
  budgetMax?: number;
  joinedAt: ISODateTime;
}

export interface ShortlistItem {
  groupId: ID;
  floorPlanId: ID;
  addedBy: ID;
  note?: string;
  createdAt: ISODateTime;
}

export interface Vote {
  groupId: ID;
  userId: ID;
  floorPlanId: ID;
  /** 1 = yes, -1 = no, 0 = cleared. */
  value: 1 | 0 | -1;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface ReviewRatings {
  /** 1 = loud, 5 = quiet. */
  noise: number;
  maintenance: number;
  landlordResponsiveness: number;
  value: number;
  /** Optional rating of how an accommodation request went. */
  accommodation?: number;
}

export interface Review {
  id: ID;
  propertyId: ID;
  userId: ID;
  ratings: ReviewRatings;
  text: string;
  status: 'pending' | 'published' | 'rejected';
  landlordReply?: string;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type AlertTrigger = 'new_listing' | 'price_drop' | 'few_left';

export type AlertTarget =
  | { kind: 'property'; propertyId: ID }
  | { kind: 'search'; filters: ListingFilters };

export interface Alert {
  id: ID;
  userId: ID;
  triggers: AlertTrigger[];
  target: AlertTarget;
  createdAt: ISODateTime;
}

export interface AlertEvent {
  id: ID;
  alertId: ID;
  userId: ID;
  trigger: AlertTrigger;
  propertyId: ID;
  floorPlanId?: ID;
  message: string;
  createdAt: ISODateTime;
  readAt?: ISODateTime;
}

/** An alert event before the store assigns id/createdAt. */
export type AlertEventDraft = Omit<AlertEvent, 'id' | 'createdAt' | 'readAt'>;

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export interface RentalHistoryEntry {
  address: string;
  landlordName?: string;
  landlordContact?: string;
  from: ISODate;
  to?: ISODate;
}

export interface Reference {
  name: string;
  contact: string;
  relationship: string;
}

/** Fields encrypted at rest. Never shown to roommates. No SSNs: the screening partner collects those. */
export interface ApplicantSensitive {
  monthlyIncome?: number;
  incomeSource?: 'guarantor' | 'employment' | 'financial_aid' | 'savings' | 'other';
  guarantor?: { name: string; email: string; relationship: string; phone?: string };
  rentalHistory: RentalHistoryEntry[];
  references: Reference[];
  dateOfBirth?: ISODate;
}

export interface ApplicantProfile {
  userId: ID;
  legalName: string;
  phone: string;
  currentAddress: string;
  studentStatus: 'undergraduate' | 'graduate' | 'other';
  expectedGraduation?: string;
  /** ID check is done by the screening partner later; v1 stores only the flag. */
  idVerified: boolean;
  sensitive: ApplicantSensitive;
  updatedAt: ISODateTime;
}

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'waitlisted'
  | 'denied'
  | 'lease_sent'
  | 'signed'
  | 'withdrawn';

export interface FeeLine {
  label: string;
  amount: number;
  refundable: boolean;
}

export interface FeeQuote {
  /** Lines per person for one application. */
  perPerson: FeeLine[];
  perPersonTotal: number;
  people: number;
  /** perPersonTotal x people. */
  applicationTotal: number;
  /** Problems with the landlord's fees under Va. Code § 55.1-1203, if any. */
  complianceIssues: string[];
}

export interface Application {
  id: ID;
  /** Leader (solo applicant or group leader). */
  userId: ID;
  groupId?: ID;
  floorPlanId: ID;
  /** Applications sent together share a batchId; rank 1 = first choice (max 3). */
  batchId: ID;
  batchRank: number;
  status: ApplicationStatus;
  statusHistory: { status: ApplicationStatus; at: ISODateTime; by: ID }[];
  fees: FeeQuote;
  submittedAt?: ISODateTime;
  decidedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface ApplicationMember {
  id: ID;
  applicationId: ID;
  kind: 'leader' | 'roommate' | 'guarantor';
  userId?: ID;
  email: string;
  name?: string;
  /** Secret token in the member's invite link: /apply/invite/<inviteToken>. */
  inviteToken: string;
  inviteStatus: 'pending' | 'accepted';
  /** Their part is complete (profile attached, or guarantor signed). */
  done: boolean;
  /** For guarantors: the member they guarantee. */
  guarantorFor?: ID;
  updatedAt: ISODateTime;
}

/** What a roommate may see about another member: done or not, nothing else. */
export interface MemberStatusView {
  memberId: ID;
  name: string;
  kind: ApplicationMember['kind'];
  done: boolean;
}

export interface ApplicationDocument {
  id: ID;
  memberId: ID;
  filename: string;
  mime: string;
  /** Opaque key into encrypted file storage. */
  storageKey: string;
  /** Deleted on or after this date (after the decision). */
  deleteAfter: ISODate;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Landlords
// ---------------------------------------------------------------------------

export interface Landlord {
  id: ID;
  /** The landlord's login. Absent for landlords seeded from public data. */
  userId?: ID;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  verified: boolean;
  createdAt: ISODateTime;
}
