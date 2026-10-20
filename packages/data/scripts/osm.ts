import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USER_AGENT = "Homed-data-builder/0.1 (+https://github.com/Azrkiel/Homed)";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const MIN_INTERVAL_MS = 1000;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 90_000;

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), ".cache");

export const BBOX = { south: 37.98, north: 38.1, west: -78.58, east: -78.42 };

export function inBbox(lat: number, lng: number): boolean {
  return lat >= BBOX.south && lat <= BBOX.north && lng >= BBOX.west && lng <= BBOX.east;
}

export interface NominatimResult {
  lat: number;
  lng: number;
  displayName: string;
  osmType: string;
  osmId: number;
  class: string;
  type: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let lastRequestAt = 0;
async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  // Reserve the slot before sleeping so concurrent callers queue up.
  lastRequestAt = Math.max(Date.now(), lastRequestAt + MIN_INTERVAL_MS);
  if (wait > 0) await sleep(wait);
}

async function cacheGet(key: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(join(CACHE_DIR, `${key}.json`), "utf8"));
  } catch {
    return undefined;
  }
}

async function cacheSet(key: string, value: unknown): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(value), "utf8");
}

const cacheKey = (endpoint: string, query: string) =>
  createHash("sha1").update(endpoint + query).digest("hex");

class RetryableError extends Error {}

async function attempt(url: string, init: RequestInit): Promise<unknown> {
  await throttle();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    throw new RetryableError(`network/timeout: ${(e as Error).message}`);
  }
  if (res.status === 429 || res.status >= 500) {
    throw new RetryableError(`HTTP ${res.status} from ${url}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

async function withRetries(urls: string[], init: RequestInit, urlSuffix = ""): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    // Rotate endpoint on each retry (primary first, then fallback).
    const url = urls[i % urls.length]! + urlSuffix;
    try {
      return await attempt(url, init);
    } catch (e) {
      lastErr = e;
      if (!(e instanceof RetryableError)) throw e;
      if (i < MAX_ATTEMPTS - 1) await sleep(2000 * 2 ** i);
    }
  }
  throw lastErr;
}

export async function nominatimSearch(query: string): Promise<NominatimResult[]> {
  const key = cacheKey(NOMINATIM_URL, query);
  const hit = await cacheGet(key);
  if (hit !== undefined) return hit as NominatimResult[];

  const qs = `?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const raw = (await withRetries([NOMINATIM_URL], { method: "GET" }, qs)) as Array<
    Record<string, unknown>
  >;
  const out: NominatimResult[] = raw.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lon),
    displayName: String(r.display_name),
    osmType: String(r.osm_type),
    osmId: Number(r.osm_id),
    class: String(r.category ?? r.class ?? ""),
    type: String(r.type ?? ""),
  }));
  await cacheSet(key, out);
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function overpass(query: string): Promise<any> {
  const key = cacheKey(OVERPASS_URLS[0]!, query);
  const hit = await cacheGet(key);
  if (hit !== undefined) return hit;

  const body = new URLSearchParams({ data: query }).toString();
  const out = await withRetries(OVERPASS_URLS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  await cacheSet(key, out);
  return out;
}
