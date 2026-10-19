import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Building, Landmark, LatLng, Property, TargetKind, WalkTime } from "@homed/core";

const USER_AGENT = "Homed-data-builder/0.1 (+https://github.com/Azrkiel/Homed)";
const PUBLIC_OSRM = "https://routing.openstreetmap.de/routed-foot";
const MIN_INTERVAL_MS = 1000;
const MAX_COORDS = 100; // per request, including the source
const REQUEST_TIMEOUT_MS = 60_000;

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, ".cache");
const DEFAULT_DATA_DIR = resolve(HERE, "..", "seed");

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Straight-line meters x 1.3 detour factor at 80 m/min, min 1 minute. */
export function estimateWalkMinutes(a: LatLng, b: LatLng): number {
  return Math.max(1, Math.round((haversineMeters(a, b) * 1.3) / 80));
}

/**
 * Door-to-door bus estimate: 3 min walk to stop + 5 min wait + ride (1.4x detour at 18 km/h)
 * + 3 min walk from stop. Returns null when not on a bus route or when the bus is not at
 * least 3 minutes faster than walking.
 */
export function estimateBusMinutes(
  onBusRoute: boolean,
  a: LatLng,
  b: LatLng,
  walkMinutes: number,
): number | null {
  if (!onBusRoute) return null;
  const km = haversineMeters(a, b) / 1000;
  const bus = Math.round(3 + 5 + ((km * 1.4) / 18) * 60 + 3);
  return walkMinutes - bus >= 3 ? bus : null;
}

export interface Target {
  id: string;
  kind: TargetKind;
  location: LatLng;
}

export function buildTargets(buildings: Building[], landmarks: Landmark[]): Target[] {
  return [
    ...buildings.map((b) => ({ id: b.id, kind: "building" as const, location: b.entrance })),
    ...landmarks.map((l) => ({ id: l.id, kind: "landmark" as const, location: l.location })),
  ];
}

const pairKey = (p: string, t: string) => `${p}|${t}`;

export function expectedPairs(
  properties: Pick<Property, "id">[],
  buildings: Pick<Building, "id">[],
  landmarks: Pick<Landmark, "id">[],
): Array<{ propertyId: string; targetId: string; targetKind: TargetKind }> {
  const out: Array<{ propertyId: string; targetId: string; targetKind: TargetKind }> = [];
  for (const p of properties) {
    for (const b of buildings) out.push({ propertyId: p.id, targetId: b.id, targetKind: "building" });
    for (const l of landmarks) out.push({ propertyId: p.id, targetId: l.id, targetKind: "landmark" });
  }
  return out;
}

export function checkMatrix(
  rows: WalkTime[],
  properties: Pick<Property, "id">[],
  buildings: Pick<Building, "id">[],
  landmarks: Pick<Landmark, "id">[],
): string[] {
  const errors: string[] = [];
  const propIds = new Set(properties.map((p) => p.id));
  const targetKinds = new Map<string, TargetKind>();
  for (const b of buildings) targetKinds.set(b.id, "building");
  for (const l of landmarks) targetKinds.set(l.id, "landmark");

  const seen = new Set<string>();
  for (const r of rows) {
    const k = pairKey(r.propertyId, r.targetId);
    const label = `${r.propertyId} -> ${r.targetId}`;
    if (seen.has(k)) errors.push(`duplicate row: ${label}`);
    seen.add(k);
    if (!propIds.has(r.propertyId)) errors.push(`unknown property id: ${r.propertyId} (row ${label})`);
    const kind = targetKinds.get(r.targetId);
    if (kind === undefined) errors.push(`unknown target id: ${r.targetId} (row ${label})`);
    else if (kind !== r.targetKind) {
      errors.push(`wrong targetKind for ${label}: ${r.targetKind}, expected ${kind}`);
    }
    if (!Number.isInteger(r.walkMinutes) || r.walkMinutes < 1) {
      errors.push(`invalid walkMinutes for ${label}: ${String(r.walkMinutes)}`);
    }
    if (r.busMinutes !== null && (!Number.isInteger(r.busMinutes) || r.busMinutes < 1)) {
      errors.push(`invalid busMinutes for ${label}: ${String(r.busMinutes)}`);
    }
  }
  for (const e of expectedPairs(properties, buildings, landmarks)) {
    if (!seen.has(pairKey(e.propertyId, e.targetId))) {
      errors.push(`missing row: ${e.propertyId} -> ${e.targetId}`);
    }
  }
  return errors;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------------------
// OSRM
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let lastRequestAt = 0;
async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  lastRequestAt = Math.max(Date.now(), lastRequestAt + MIN_INTERVAL_MS);
  if (wait > 0) await sleep(wait);
}

class OsrmUnavailable extends Error {}

/** Returns durations in seconds (null where unroutable) for each destination. */
async function osrmTable(
  base: string,
  source: LatLng,
  dests: LatLng[],
): Promise<Array<number | null>> {
  const coords = [source, ...dests].map((c) => `${c.lng},${c.lat}`).join(";");
  const url = `${base.replace(/\/+$/, "")}/table/v1/foot/${coords}?sources=0&annotations=duration`;
  const key = createHash("sha1").update(url).digest("hex");
  try {
    return JSON.parse(await readFile(join(CACHE_DIR, `${key}.json`), "utf8")) as Array<number | null>;
  } catch {
    /* cache miss */
  }
  await throttle();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    throw new OsrmUnavailable(`network error: ${(e as Error).message}`);
  }
  if (!res.ok) throw new OsrmUnavailable(`HTTP ${res.status} from ${base}`);
  let body: { code?: string; durations?: Array<Array<number | null>> };
  try {
    body = (await res.json()) as typeof body;
  } catch (e) {
    throw new OsrmUnavailable(`bad JSON: ${(e as Error).message}`);
  }
  const row = body.durations?.[0];
  if (body.code !== "Ok" || !row || row.length !== dests.length + 1) {
    throw new OsrmUnavailable(`unexpected OSRM response (code ${String(body.code)})`);
  }
  const out = row.slice(1);
  if (out.every((d) => d === null)) throw new OsrmUnavailable("all durations null");
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(out), "utf8");
  return out;
}

// ---------------------------------------------------------------------------
// IO + CLI
// ---------------------------------------------------------------------------

async function readJson<T>(dir: string, name: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, name), "utf8")) as T;
}

async function generate(dataDir: string): Promise<void> {
  const properties = await readJson<Property[]>(dataDir, "properties.json");
  const buildings = await readJson<Building[]>(dataDir, "buildings.json");
  const landmarks = await readJson<Landmark[]>(dataDir, "landmarks.json");
  const targets = buildTargets(buildings, landmarks);

  const osrmBase = process.env.OSRM_URL?.trim() || PUBLIC_OSRM;
  let osrmOk = true;
  let osrmRows = 0;
  let estRows = 0;
  const rows: WalkTime[] = [];
  const chunkSize = MAX_COORDS - 1;

  for (const p of properties) {
    const walk = new Map<string, { minutes: number; source: "osrm" | "estimate" }>();
    for (let i = 0; i < targets.length; i += chunkSize) {
      const chunk = targets.slice(i, i + chunkSize);
      let secs: Array<number | null> | null = null;
      if (osrmOk) {
        try {
          secs = await osrmTable(osrmBase, p.location, chunk.map((t) => t.location));
        } catch (e) {
          osrmOk = false;
          console.warn(
            `OSRM unavailable (${(e as Error).message}); using estimates for the rest of the run`,
          );
        }
      }
      chunk.forEach((t, j) => {
        const s = secs?.[j];
        if (typeof s === "number" && Number.isFinite(s)) {
          walk.set(t.id, { minutes: Math.max(1, Math.round(s / 60)), source: "osrm" });
          osrmRows++;
        } else {
          walk.set(t.id, { minutes: estimateWalkMinutes(p.location, t.location), source: "estimate" });
          estRows++;
        }
      });
    }
    for (const t of targets) {
      const w = walk.get(t.id)!;
      rows.push({
        propertyId: p.id,
        targetId: t.id,
        targetKind: t.kind,
        walkMinutes: w.minutes,
        busMinutes: estimateBusMinutes(p.onBusRoute, p.location, t.location, w.minutes),
        source: w.source,
      });
    }
  }

  rows.sort((a, b) => cmp(a.propertyId, b.propertyId) || cmp(a.targetId, b.targetId));
  await writeFile(join(dataDir, "walk_times.json"), JSON.stringify(rows, null, 2) + "\n", "utf8");
  console.log(
    `wrote ${rows.length} rows to ${join(dataDir, "walk_times.json")} (osrm ${osrmRows}, estimate ${estRows})`,
  );
}

async function check(dataDir: string): Promise<number> {
  const properties = await readJson<Property[]>(dataDir, "properties.json");
  const buildings = await readJson<Building[]>(dataDir, "buildings.json");
  const landmarks = await readJson<Landmark[]>(dataDir, "landmarks.json");
  const rows = await readJson<WalkTime[]>(dataDir, "walk_times.json");
  const errors = checkMatrix(rows, properties, buildings, landmarks);
  if (errors.length > 0) {
    console.error(`walk_times FAILED: ${errors.length} problem(s)`);
    for (const e of errors) console.error(`  - ${e}`);
    return 1;
  }
  console.log(
    `walk_times OK: ${rows.length} rows (${properties.length} properties x ${buildings.length + landmarks.length} targets)`,
  );
  return 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const di = args.indexOf("--data-dir");
  const dataDir = di >= 0 && args[di + 1] ? resolve(args[di + 1]!) : DEFAULT_DATA_DIR;
  if (args.includes("--check")) {
    process.exitCode = await check(dataDir);
  } else {
    await generate(dataDir);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
