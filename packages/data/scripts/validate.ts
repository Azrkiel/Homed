// Seed integrity checks. `validateSeed` is pure; the CLI at the bottom runs it on loadSeed().
import { pathToFileURL } from 'node:url';
import { loadSeed, type SeedData } from '../src/index';

export interface ValidateOptions {
  /** Enforce minimum dataset sizes. Default true. */
  checkCounts?: boolean;
  /** Enforce required landmark ids, a tradition-tagged worship landmark and the VERVE record. Default true. */
  requireLandmarks?: boolean;
}

export const BBOX = { latMin: 37.98, latMax: 38.1, lngMin: -78.58, lngMax: -78.42 };

export const REQUIRED_LANDMARKS = [
  'lawn',
  'corner',
  'clemons',
  'newcomb',
  'afc',
  'slaughter-rec',
  'ngrc',
  'grocery-barracks-kroger',
  'grocery-barracks-harris-teeter',
  'uva-hospital',
];

export const MIN_COUNTS = { properties: 45, offGrounds: 35, onGrounds: 6, buildings: 90, majors: 25 };

export const VERVE_ID = 'p-verve-charlottesville';
export const RENDERING_URL = '/placeholder/rendering.svg';

export function seedCounts(data: SeedData) {
  const onGrounds = data.properties.filter((p) => p.onGrounds).length;
  return {
    properties: data.properties.length,
    offGrounds: data.properties.length - onGrounds,
    onGrounds,
    floorPlans: data.floorPlans.length,
    buildings: data.buildings.length,
    landmarks: data.landmarks.length,
    majors: data.majors.length,
    landlords: data.landlords.length,
    photos: data.photos.length,
    accessibility: data.accessibility.length,
    walkTimes: data.walkTimes.length,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function validIsoDate(s: unknown): boolean {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function validateSeed(data: SeedData, opts: ValidateOptions = {}): string[] {
  const checkCounts = opts.checkCounts ?? true;
  const requireLandmarks = opts.requireLandmarks ?? true;
  const problems: string[] = [];
  const add = (m: string) => problems.push(m);

  // --- unique ids / slugs ---
  const uniq = (label: string, values: (string | undefined)[]) => {
    const seen = new Set<string>();
    for (const v of values) {
      if (v === undefined || v === '') {
        add(`${label}: empty or missing id`);
        continue;
      }
      if (seen.has(v)) add(`${label}: duplicate id "${v}"`);
      seen.add(v);
    }
  };
  uniq('properties', data.properties.map((p) => p.id));
  uniq('property slugs', data.properties.map((p) => p.slug));
  uniq('floorPlans', data.floorPlans.map((f) => f.id));
  uniq('buildings', data.buildings.map((b) => b.id));
  uniq('landmarks', data.landmarks.map((l) => l.id));
  uniq('majors', data.majors.map((m) => m.id));
  uniq('landlords', data.landlords.map((l) => l.id));
  uniq('photos', data.photos.map((p) => p.id));

  for (const p of data.properties) {
    if (!p.id.startsWith('p-') || p.slug !== p.id.slice(2)) {
      add(`property ${p.id}: slug "${p.slug}" must equal id without "p-"`);
    }
  }
  const bTarget = new Set(data.buildings.map((b) => b.id));
  const lTarget = new Set(data.landmarks.map((l) => l.id));
  for (const id of bTarget) if (lTarget.has(id)) add(`id "${id}" is used by both a building and a landmark`);

  // --- references ---
  const propIds = new Set(data.properties.map((p) => p.id));
  const fpById = new Map(data.floorPlans.map((f) => [f.id, f]));
  const landlordIds = new Set(data.landlords.map((l) => l.id));

  for (const f of data.floorPlans) {
    if (!propIds.has(f.propertyId)) add(`floorPlan ${f.id}: propertyId "${f.propertyId}" does not resolve`);
  }
  for (const ph of data.photos) {
    if (!propIds.has(ph.propertyId)) add(`photo ${ph.id}: propertyId "${ph.propertyId}" does not resolve`);
    if (ph.floorPlanId !== undefined) {
      const fp = fpById.get(ph.floorPlanId);
      if (!fp) add(`photo ${ph.id}: floorPlanId "${ph.floorPlanId}" does not resolve`);
      else if (fp.propertyId !== ph.propertyId) {
        add(`photo ${ph.id}: floorPlan "${ph.floorPlanId}" belongs to ${fp.propertyId}, not ${ph.propertyId}`);
      }
    }
  }
  for (const p of data.properties) {
    if (p.landlordId !== undefined && !landlordIds.has(p.landlordId)) {
      add(`property ${p.id}: landlordId "${p.landlordId}" does not resolve`);
    }
  }
  for (const a of data.accessibility) {
    if (!propIds.has(a.propertyId)) add(`accessibility: propertyId "${a.propertyId}" does not resolve`);
  }
  for (const m of data.majors) {
    for (const b of m.buildings) {
      if (!bTarget.has(b.buildingId)) add(`major ${m.id}: buildingId "${b.buildingId}" does not resolve`);
    }
  }
  for (const w of data.walkTimes) {
    if (!propIds.has(w.propertyId)) add(`walkTime: propertyId "${w.propertyId}" does not resolve`);
    const set = w.targetKind === 'building' ? bTarget : w.targetKind === 'landmark' ? lTarget : undefined;
    if (!set) add(`walkTime ${w.propertyId} -> ${w.targetId}: unknown targetKind "${String(w.targetKind)}"`);
    else if (!set.has(w.targetId)) {
      add(`walkTime ${w.propertyId} -> ${w.targetId}: targetId does not resolve as a ${w.targetKind}`);
    }
  }

  // --- coordinates ---
  const inBox = (lat: number, lng: number) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BBOX.latMin &&
    lat <= BBOX.latMax &&
    lng >= BBOX.lngMin &&
    lng <= BBOX.lngMax;
  for (const p of data.properties) {
    if (!inBox(p.location.lat, p.location.lng)) {
      add(`property ${p.id}: location (${p.location.lat}, ${p.location.lng}) outside bbox`);
    }
  }
  for (const b of data.buildings) {
    if (!inBox(b.entrance.lat, b.entrance.lng)) {
      add(`building ${b.id}: entrance (${b.entrance.lat}, ${b.entrance.lng}) outside bbox`);
    }
  }
  for (const l of data.landmarks) {
    if (!inBox(l.location.lat, l.location.lng)) {
      add(`landmark ${l.id}: location (${l.location.lat}, ${l.location.lng}) outside bbox`);
    }
  }

  // --- majors ---
  for (const m of data.majors) {
    if (m.buildings.length === 0) add(`major ${m.id}: has no buildings`);
    let sum = 0;
    for (const b of m.buildings) {
      if (!(b.share > 0)) add(`major ${m.id}: share for "${b.buildingId}" must be > 0 (got ${b.share})`);
      sum += b.share;
    }
    if (m.buildings.length > 0 && Math.abs(sum - 1) > 0.001) {
      add(`major ${m.id}: building shares sum to ${sum.toFixed(4)}, expected 1 (+-0.001)`);
    }
  }

  // --- landmarks ---
  const worship = data.landmarks.filter((l) => l.kind === 'worship');
  for (const l of worship) {
    if (!l.tradition || l.tradition.trim() === '') add(`landmark ${l.id}: worship landmark missing tradition`);
  }
  if (requireLandmarks) {
    for (const id of REQUIRED_LANDMARKS) {
      if (!lTarget.has(id)) add(`required landmark "${id}" is missing`);
    }
    const hosp = data.landmarks.find((l) => l.id === 'uva-hospital');
    if (hosp && hosp.kind !== 'health') add(`landmark uva-hospital: kind must be "health" (got "${hosp.kind}")`);
    if (!worship.some((l) => l.tradition && l.tradition.trim() !== '')) {
      add('no worship landmark with a tradition');
    }
  }

  // --- properties ---
  for (const p of data.properties) {
    if (p.onGrounds && !p.onGroundsInfo) add(`property ${p.id}: onGrounds is true but onGroundsInfo is missing`);
    if (!p.onGrounds && p.onGroundsInfo) add(`property ${p.id}: onGroundsInfo present but onGrounds is false`);
    if ((p.kind === 'on_grounds') !== p.onGrounds) {
      add(`property ${p.id}: kind "${p.kind}" inconsistent with onGrounds=${p.onGrounds}`);
    }
    if (typeof p.source !== 'string' || p.source.trim() === '') add(`property ${p.id}: source is empty`);
    if (p.dataStatus !== 'unverified_seed') {
      add(`property ${p.id}: dataStatus must be "unverified_seed" (got "${p.dataStatus}")`);
    }
    if (!validIsoDate(p.lastVerified)) add(`property ${p.id}: lastVerified "${p.lastVerified}" is not a valid ISO date`);
    if (!data.floorPlans.some((f) => f.propertyId === p.id)) add(`property ${p.id}: has no floor plans`);
    if (!data.photos.some((ph) => ph.propertyId === p.id)) add(`property ${p.id}: has no photos`);
  }

  // --- floor plans ---
  for (const f of data.floorPlans) {
    if (!Number.isInteger(f.beds) || f.beds < 0 || f.beds > 8) {
      add(`floorPlan ${f.id}: beds must be an integer 0..8 (got ${f.beds})`);
    }
    if (!(f.baths >= 1)) add(`floorPlan ${f.id}: baths must be >= 1 (got ${f.baths})`);
    if (!(f.rentAmount > 0)) add(`floorPlan ${f.id}: rentAmount must be > 0 (got ${f.rentAmount})`);
    const sOk = validIsoDate(f.leaseStart);
    const eOk = validIsoDate(f.leaseEnd);
    if (!sOk) add(`floorPlan ${f.id}: leaseStart "${f.leaseStart}" is not a valid ISO date`);
    if (!eOk) add(`floorPlan ${f.id}: leaseEnd "${f.leaseEnd}" is not a valid ISO date`);
    if (sOk && eOk && !(f.leaseEnd > f.leaseStart)) {
      add(`floorPlan ${f.id}: leaseEnd ${f.leaseEnd} must be after leaseStart ${f.leaseStart}`);
    }
    if (!validIsoDate(f.lastVerified)) add(`floorPlan ${f.id}: lastVerified "${f.lastVerified}" is not a valid ISO date`);
  }

  // --- VERVE ---
  if (requireLandmarks) {
    if (!propIds.has(VERVE_ID)) add(`${VERVE_ID} is missing`);
    else {
      for (const ph of data.photos.filter((x) => x.propertyId === VERVE_ID)) {
        if (!ph.isRendering || ph.url !== RENDERING_URL) {
          add(`photo ${ph.id}: VERVE photos must have isRendering true and url "${RENDERING_URL}"`);
        }
      }
    }
  }

  // --- walk matrix: every property x every building + landmark, exactly one row ---
  const rowCount = new Map<string, number>();
  for (const w of data.walkTimes) {
    const k = `${w.propertyId}|${w.targetKind}|${w.targetId}`;
    rowCount.set(k, (rowCount.get(k) ?? 0) + 1);
    if (!Number.isFinite(w.walkMinutes) || w.walkMinutes < 0) {
      add(`walkTime ${w.propertyId} -> ${w.targetId}: invalid walkMinutes ${w.walkMinutes}`);
    }
  }
  for (const [k, n] of rowCount) {
    if (n > 1) add(`walkTime ${k.split('|').join(' ')}: ${n} rows, expected exactly 1`);
  }
  const missing: string[] = [];
  for (const p of data.properties) {
    for (const b of data.buildings) {
      if (!rowCount.has(`${p.id}|building|${b.id}`)) missing.push(`${p.id} -> building ${b.id}`);
    }
    for (const l of data.landmarks) {
      if (!rowCount.has(`${p.id}|landmark|${l.id}`)) missing.push(`${p.id} -> landmark ${l.id}`);
    }
  }
  for (const m of missing.slice(0, 20)) add(`missing walk row: ${m}`);
  if (missing.length > 20) add(`missing walk row: ...and ${missing.length - 20} more (${missing.length} total)`);

  // --- counts ---
  if (checkCounts) {
    const c = seedCounts(data);
    for (const k of Object.keys(MIN_COUNTS) as (keyof typeof MIN_COUNTS)[]) {
      if (c[k] < MIN_COUNTS[k]) add(`count ${k}: ${c[k]} < required ${MIN_COUNTS[k]}`);
    }
  }

  return problems;
}

function main() {
  const data = loadSeed();
  const problems = validateSeed(data);
  console.log('seed counts:', JSON.stringify(seedCounts(data)));
  if (problems.length > 0) {
    console.error(`${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('seed OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
