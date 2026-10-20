// Plain TS mirrors of the JSON DTOs returned by apps/web/src/app/api/mobile (see _lib.ts).
// Keep in sync by hand. Do not import from the web app.

export type ListingBadge =
  | 'renderings_only'
  | 'stale'
  | 'accommodation_friendly'
  | 'few_left'
  | 'private_bath'
  | 'on_grounds'
  | 'individual_lease';

export type LeaseTermKind = '12_month' | 'academic_year' | 'semester' | 'other';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
}

export interface SessionDTO {
  token: string;
  user: UserDTO;
}

export interface ListingDTO {
  floorPlanId: string;
  propertyId: string;
  propertyName: string;
  floorPlanName: string;
  neighborhood: string;
  address: string;
  bedBath: string;
  onGrounds: boolean;
  photoUrl: string | null;
  photoIsRendering: boolean;
  scoreTotal: number;
  totalMonthly: number;
  why: string;
  badges: ListingBadge[];
  lastVerified: string;
}

export interface WalkTimeDTO {
  name: string;
  kind: 'building' | 'landmark';
  walkMinutes: number;
  busMinutes: number | null;
}

export interface PhotoDTO {
  url: string;
  alt: string;
  isRendering: boolean;
}

export interface CostDTO {
  rent: number;
  utilities: number;
  internet: number;
  parking: number;
  furniture: number;
  totalMonthly: number;
  leaseMonths: number;
  totalLease: number;
  note?: string;
}

export interface ListingDetailDTO extends ListingDTO {
  score: {
    price: number;
    location: number;
    looks: number;
    looksBasis: 'photos_and_age' | 'age_only';
  };
  cost: CostDTO;
  commute: {
    averageMinutes: number;
    earliestClassMinutes: number | null;
    usesBus: boolean;
    weeklyMinutes: number;
  };
  walkTimes: WalkTimeDTO[];
  photos: PhotoDTO[];
  rentAmount: number;
  rentBasis: 'per_bed' | 'per_unit';
  beds: number;
  baths: number;
  sqft?: number;
  leaseStart: string;
  leaseEnd: string;
  termKind: LeaseTermKind;
  furnished: boolean;
  utilitiesIncluded: boolean;
  amenities: string[];
  website?: string;
  saved: boolean;
}

export interface SaveDTO {
  floorPlanId: string;
  note: string;
  createdAt: string;
  listing: ListingDTO | null;
}

export type AlertTrigger = 'new_listing' | 'price_drop' | 'few_left';

export interface AlertEventDTO {
  id: string;
  trigger: AlertTrigger;
  message: string;
  propertyId: string;
  floorPlanId?: string;
  createdAt: string;
  read: boolean;
}

export interface ListingsResponse {
  listings: ListingDTO[];
}

export interface SavesResponse {
  saves: SaveDTO[];
}

export interface AlertsResponse {
  events: AlertEventDTO[];
}

export interface SwipeResponse {
  ok: boolean;
  saved: boolean;
}
