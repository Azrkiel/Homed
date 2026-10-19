import type {
  AccessibilityInfo,
  Alert,
  AlertEvent,
  ApplicantProfile,
  Application,
  ApplicationDocument,
  ApplicationMember,
  Building,
  FloorPlan,
  Group,
  GroupMember,
  Landlord,
  Landmark,
  Major,
  Photo,
  Property,
  Review,
  Save,
  Section,
  ShortlistItem,
  Swipe,
  User,
  UserSchedule,
  Vote,
  WalkTime,
} from '@homed/core';
import type { SeedData } from '@homed/data';

export interface PhotoRating {
  photoId: string;
  userId: string;
  rating: number;
}

/** ApplicantProfile with `sensitive` stored as an encrypted envelope string. */
export type StoredProfile = Omit<ApplicantProfile, 'sensitive'> & { sensitive: string };

export interface Catalog {
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

export interface State {
  schemaVersion: 1;
  catalog: Catalog;
  users: User[];
  schedules: UserSchedule[];
  saves: Save[];
  swipes: Swipe[];
  groups: Group[];
  groupMembers: GroupMember[];
  shortlist: ShortlistItem[];
  votes: Vote[];
  alerts: Alert[];
  alertEvents: AlertEvent[];
  reviews: Review[];
  photoRatings: PhotoRating[];
  profiles: StoredProfile[];
  applications: Application[];
  applicationMembers: ApplicationMember[];
  documents: ApplicationDocument[];
  documentBlobs: Record<string, string>;
}

export function stateFromSeed(seed: SeedData): State {
  const { meta: _meta, ...catalog } = structuredClone(seed);
  return {
    schemaVersion: 1,
    catalog,
    users: [],
    schedules: [],
    saves: [],
    swipes: [],
    groups: [],
    groupMembers: [],
    shortlist: [],
    votes: [],
    alerts: [],
    alertEvents: [],
    reviews: [],
    photoRatings: [],
    profiles: [],
    applications: [],
    applicationMembers: [],
    documents: [],
    documentBlobs: {},
  };
}
