// Shared code for the mobile JSON API: CORS, bearer auth, error mapping, body parsing and DTOs.
// Not a route (underscore file). Route modules import from here.
import type {
  AlertEvent,
  Building,
  CommuteSummary,
  CostBreakdown,
  FloorPlan,
  ID,
  ISODate,
  ISODateTime,
  Landmark,
  ListingBadge,
  MatchScore,
  Photo,
  PropertyAmenities,
  RankedListing,
  SwipeDirection,
  User,
  WalkTime,
} from '@homed/core';
import { scoringContextFor } from '../../../lib/ranking';
import { bedBath } from '../../../lib/format';
import { getBearerUser } from '../../../lib/session';
import { RepoError, type Repository, type RepoErrorCode } from '@homed/db';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** An error with an HTTP status and a message that is safe to show the client. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function badRequest(message: string): ApiError {
  return new ApiError(400, message);
}

export function notFound(message: string): ApiError {
  return new ApiError(404, message);
}

const REPO_STATUS: Record<RepoErrorCode, number> = {
  invalid: 400,
  conflict: 409,
  forbidden: 403,
  not_found: 404,
};

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOW_HEADERS = 'Authorization, Content-Type';
const ALLOW_METHODS = 'GET, POST, DELETE, OPTIONS';

function parseIPv4(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
}

/** localhost, loopback, and private LAN IPv4 (10/8, 172.16/12, 192.168/16). */
function isLocalOrLanHost(host: string): boolean {
  if (host === 'localhost' || host === '[::1]') return true;
  const octets = parseIPv4(host);
  if (!octets) return false;
  const [a, b] = octets as [number, number, number, number];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function extraOrigins(): string[] {
  return (process.env.HOMED_MOBILE_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o !== '');
}

/** The Origin to reflect, or null when the origin is not allowed. */
export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (extraOrigins().includes(origin)) return origin;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== origin) return null;
  return isLocalOrLanHost(url.hostname) ? origin : null;
}

function applyCors(req: Request, headers: Headers): void {
  headers.set('Vary', 'Origin');
  const origin = allowedOrigin(req.headers.get('origin'));
  if (!origin) return;
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS);
  headers.set('Access-Control-Allow-Methods', ALLOW_METHODS);
  headers.set('Access-Control-Max-Age', '600');
}

/** 204 answer to a CORS preflight. No auth. */
export function preflight(req: Request): Response {
  const headers = new Headers();
  applyCors(req, headers);
  return new Response(null, { status: 204, headers });
}

/** JSON response with CORS headers for the request's origin. */
export function json(req: Request, body: unknown, status = 200): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  applyCors(req, headers);
  return Response.json(body, { status, headers });
}

// ---------------------------------------------------------------------------
// Auth, errors, bodies
// ---------------------------------------------------------------------------

/** The signed-in user (Bearer token only, never the browser cookie), or a 401 response to return as-is. */
export async function requireApiUser(req: Request): Promise<User | Response> {
  const user = await getBearerUser(req);
  return user ?? json(req, { error: 'Sign in required' }, 401);
}

/** Runs a handler; maps ApiError and RepoError to JSON, anything else to a generic 500 (no stack leaks). */
export async function withApi(req: Request, handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (e) {
    if (e instanceof ApiError) return json(req, { error: e.message }, e.status);
    if (e instanceof RepoError) return json(req, { error: e.message || 'Request failed' }, REPO_STATUS[e.code]);
    console.error('mobile api:', e);
    return json(req, { error: 'Server error' }, 500);
  }
}

/** Parsed JSON body, or undefined when the body is empty. Invalid JSON -> 400. */
export async function readJson(req: Request): Promise<unknown> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw badRequest('Could not read the request body');
  }
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw badRequest('Body must be valid JSON');
  }
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest('Body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

export function requireFloorPlanId(value: unknown): ID {
  if (typeof value !== 'string' || value.trim() === '') throw badRequest('floorPlanId is required');
  return value.trim();
}

export function parseDirection(value: unknown): SwipeDirection {
  if (value === 'right') return 'right';
  if (value === 'left') return 'left';
  throw badRequest('direction must be "right" or "left"');
}

/** Request origin, e.g. "http://192.168.1.5:3010". Used to absolutize root-relative photo urls. */
export function originOf(req: Request): string {
  return new URL(req.url).origin;
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface ListingDTO {
  floorPlanId: ID;
  propertyId: ID;
  propertyName: string;
  floorPlanName: string;
  neighborhood: string;
  address: string;
  /** "4 bd / 4 ba", "Studio / 1 ba". */
  bedBath: string;
  onGrounds: boolean;
  /** First real photo, else first rendering, else null. */
  photoUrl: string | null;
  photoIsRendering: boolean;
  scoreTotal: number;
  /** All-in monthly cost per person. */
  totalMonthly: number;
  why: string;
  badges: ListingBadge[];
  lastVerified: ISODate;
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

export interface ListingDetailDTO extends ListingDTO {
  score: {
    price: number;
    location: number;
    looks: number;
    looksBasis: MatchScore['looksBasis'];
  };
  cost: CostBreakdown;
  commute: {
    averageMinutes: number;
    earliestClassMinutes: number | null;
    usesBus: boolean;
    weeklyMinutes: number;
  };
  walkTimes: WalkTimeDTO[];
  photos: PhotoDTO[];
  rentAmount: number;
  rentBasis: FloorPlan['rentBasis'];
  beds: number;
  baths: number;
  sqft?: number;
  leaseStart: ISODate;
  leaseEnd: ISODate;
  termKind: FloorPlan['termKind'];
  furnished: boolean;
  utilitiesIncluded: boolean;
  /** Human labels of the amenities that are true. */
  amenities: string[];
  website?: string;
  saved: boolean;
}

export interface SaveDTO {
  floorPlanId: ID;
  note: string;
  createdAt: ISODateTime;
  listing: ListingDTO | null;
}

export interface AlertEventDTO {
  id: ID;
  trigger: AlertEvent['trigger'];
  message: string;
  propertyId: ID;
  floorPlanId?: ID;
  createdAt: ISODateTime;
  read: boolean;
}

/** Absolute url for root-relative paths ("/x.jpg"); other urls pass through. */
export function absolutize(url: string, origin: string): string {
  return url.startsWith('/') && !url.startsWith('//') ? `${origin}${url}` : url;
}

/** Real photos first, then renderings. Same order as the web match deck. */
function orderedPhotos(photos: Photo[]): Photo[] {
  return [...photos.filter((p) => !p.isRendering), ...photos.filter((p) => p.isRendering)];
}

export function toListingDTO(ranked: RankedListing, origin: string): ListingDTO {
  const { listing, score } = ranked;
  const { property, floorPlan } = listing;
  const photo = orderedPhotos(listing.photos)[0];
  return {
    floorPlanId: floorPlan.id,
    propertyId: property.id,
    propertyName: property.name,
    floorPlanName: floorPlan.name,
    neighborhood: property.neighborhood,
    address: property.address,
    bedBath: bedBath(floorPlan.beds, floorPlan.baths),
    onGrounds: property.onGrounds,
    photoUrl: photo ? absolutize(photo.url, origin) : null,
    photoIsRendering: photo ? photo.isRendering : false,
    scoreTotal: score.total,
    totalMonthly: score.cost.totalMonthly,
    why: score.why,
    badges: score.badges,
    lastVerified: floorPlan.lastVerified,
  };
}

const AMENITY_LABELS: [keyof PropertyAmenities, string][] = [
  ['gym', 'Gym'],
  ['studyRooms', 'Study rooms'],
  ['rooftop', 'Rooftop'],
  ['pool', 'Pool'],
  ['elevator', 'Elevator'],
  ['parkingAvailable', 'Parking'],
  ['petsAllowed', 'Pets allowed'],
];

export function toListingDetailDTO(
  ranked: RankedListing,
  origin: string,
  extra: { walkTimes: WalkTimeDTO[]; saved: boolean },
): ListingDetailDTO {
  const { listing, score } = ranked;
  const { property, floorPlan, photos } = listing;
  const commute: CommuteSummary = score.commute;
  const detail: ListingDetailDTO = {
    ...toListingDTO(ranked, origin),
    score: { price: score.price, location: score.location, looks: score.looks, looksBasis: score.looksBasis },
    cost: score.cost,
    commute: {
      averageMinutes: commute.averageMinutes,
      earliestClassMinutes: commute.earliestClassMinutes,
      usesBus: commute.usesBus,
      weeklyMinutes: commute.weeklyMinutes,
    },
    walkTimes: extra.walkTimes,
    photos: orderedPhotos(photos)
      .slice(0, 8)
      .map((p) => ({ url: absolutize(p.url, origin), alt: p.alt, isRendering: p.isRendering })),
    rentAmount: floorPlan.rentAmount,
    rentBasis: floorPlan.rentBasis,
    beds: floorPlan.beds,
    baths: floorPlan.baths,
    leaseStart: floorPlan.leaseStart,
    leaseEnd: floorPlan.leaseEnd,
    termKind: floorPlan.termKind,
    furnished: floorPlan.furnished,
    utilitiesIncluded: floorPlan.utilitiesIncluded,
    amenities: AMENITY_LABELS.filter(([key]) => property.amenities[key] === true).map(([, label]) => label),
    saved: extra.saved,
  };
  if (floorPlan.sqft !== undefined) detail.sqft = floorPlan.sqft;
  if (property.website !== undefined) detail.website = property.website;
  return detail;
}

export function toAlertEventDTO(event: AlertEvent): AlertEventDTO {
  const dto: AlertEventDTO = {
    id: event.id,
    trigger: event.trigger,
    message: event.message,
    propertyId: event.propertyId,
    createdAt: event.createdAt,
    read: event.readAt !== undefined,
  };
  if (event.floorPlanId !== undefined) dto.floorPlanId = event.floorPlanId;
  return dto;
}

/**
 * The user's class buildings (weekly meetings) then chosen extra landmarks, deduped, with walk
 * times for this property. Capped at 12.
 */
export async function walkTimesFor(repo: Repository, user: User, propertyId: ID): Promise<WalkTimeDTO[]> {
  const ctx = await scoringContextFor(user);
  const wantedIds = [...new Set([...ctx.meetings.map((m) => m.buildingId), ...ctx.extras])];
  const [walks, buildings, landmarks]: [WalkTime[], Building[], Landmark[]] = await Promise.all([
    repo.listWalkTimes([propertyId]),
    repo.listBuildings(),
    repo.listLandmarks(),
  ]);
  const walkBy = new Map<string, WalkTime>(walks.map((w) => [w.targetId, w]));
  const buildingBy = new Map(buildings.map((b) => [b.id, b]));
  const landmarkBy = new Map(landmarks.map((l) => [l.id, l]));

  const out: WalkTimeDTO[] = [];
  for (const id of wantedIds) {
    if (out.length >= 12) break;
    const walk = walkBy.get(id);
    if (!walk) continue;
    const building = buildingBy.get(id);
    const landmark = building ? undefined : landmarkBy.get(id);
    if (building) {
      out.push({ name: building.name, kind: 'building', walkMinutes: walk.walkMinutes, busMinutes: walk.busMinutes });
    } else if (landmark) {
      out.push({ name: landmark.name, kind: 'landmark', walkMinutes: walk.walkMinutes, busMinutes: walk.busMinutes });
    }
  }
  return out;
}
