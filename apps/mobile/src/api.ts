// Typed fetch wrapper for /api/mobile. Adds the bearer token, JSON in/out, maps failures to ApiError.
import { API_URL } from './config';
import { getToken } from './storage';
import type {
  AlertEventDTO,
  AlertsResponse,
  ListingDetailDTO,
  ListingDTO,
  ListingsResponse,
  SaveDTO,
  SavesResponse,
  SessionDTO,
  SwipeResponse,
} from './api-types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Called on every 401. AuthProvider registers its signOut here. */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

function errorMessageFrom(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const message: unknown = (data as { error: unknown }).error;
    if (typeof message === 'string' && message !== '') return message;
  }
  return `Request failed (${status})`;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the server at ${API_URL}. Check EXPO_PUBLIC_API_URL and that the web app is running.`,
    );
  }

  const data = await readBody(res);
  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.();
    throw new ApiError(res.status, errorMessageFrom(data, res.status));
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function signIn(email: string, name?: string): Promise<SessionDTO> {
  return api<SessionDTO>('/api/mobile/session', { method: 'POST', body: { email, name } });
}

export async function getListings(): Promise<ListingDTO[]> {
  return (await api<ListingsResponse>('/api/mobile/listings')).listings;
}

/** Listings the user has not swiped yet, in Match queue order. */
export async function getMatchQueue(): Promise<ListingDTO[]> {
  return (await api<ListingsResponse>('/api/mobile/listings?queue=match')).listings;
}

export function getListing(floorPlanId: string): Promise<ListingDetailDTO> {
  return api<ListingDetailDTO>(`/api/mobile/listings/${encodeURIComponent(floorPlanId)}`);
}

export function postSwipe(floorPlanId: string, direction: 'right' | 'left'): Promise<SwipeResponse> {
  return api<SwipeResponse>('/api/mobile/swipes', { method: 'POST', body: { floorPlanId, direction } });
}

export async function getSaves(): Promise<SaveDTO[]> {
  return (await api<SavesResponse>('/api/mobile/saves')).saves;
}

export async function addSave(floorPlanId: string, note?: string): Promise<void> {
  await api<{ ok: boolean }>('/api/mobile/saves', { method: 'POST', body: { floorPlanId, note } });
}

export async function removeSave(floorPlanId: string): Promise<void> {
  await api<{ ok: boolean }>(`/api/mobile/saves?floorPlanId=${encodeURIComponent(floorPlanId)}`, {
    method: 'DELETE',
  });
}

/** Alert events, newest first. */
export async function getAlerts(): Promise<AlertEventDTO[]> {
  const { events } = await api<AlertsResponse>('/api/mobile/alerts');
  return [...events].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}
