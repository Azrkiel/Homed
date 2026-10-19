// Merge research batches A-I into packages/data/seed/*.json, geocoding via OSM.
// Rerunnable offline from scripts/.cache. Run: npx tsx packages/data/scripts/merge-research.ts
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AccessibilityInfo, FloorPlan, Landlord, Photo, Property } from "@homed/core";
import { BBOX, inBbox, nominatimSearch, overpass, type NominatimResult } from "./osm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = join(HERE, "..", "seed");
const ROTUNDA = { lat: 38.0356, lng: -78.5034 };
const MAX_KM = 4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const dropped: string[] = [];
const review: string[] = [];
const drop = (what: string, why: string) => dropped.push(`${what}: ${why}`);

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const near = (lat: number, lng: number) => inBbox(lat, lng) && km({ lat, lng }, ROTUNDA) <= MAX_KM;
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

async function firstHit(queries: string[]): Promise<{ r: NominatimResult; q: string } | null> {
  for (const q of queries) {
    let res: NominatimResult[] = [];
    try {
      res = await nominatimSearch(q);
    } catch (e) {
      review.push(`  nominatim error for "${q}": ${(e as Error).message}`);
    }
    const r = res.find((x) => near(x.lat, x.lng));
    if (r) return { r, q };
  }
  return null;
}

/** "<number> <street>, Charlottesville, Virginia" from a full address; null if no street number. */
function simplified(address: string): string | null {
  const first = address.split(",")[0]!.replace(/\bApt\s+\w+$/i, "").trim();
  const m = /^(\d+)(?:-\d+)?\s+(.+)$/.exec(first);
  if (!m) return null;
  return `${m[1]} ${m[2]}, Charlottesville, Virginia`;
}

async function overpassByName(name: string): Promise<Hit | null> {
  const safe = name.replace(/[^A-Za-z0-9 ]/g, "").trim();
  const q = `[out:json][timeout:60];nwr["name"~"${safe}",i](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});out center 10;`;
  try {
    const j = await overpass(q);
    for (const el of j.elements ?? []) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat != null && near(lat, lng))
        return { lat, lng, label: `overpass ${el.type}/${el.id} ${el.tags?.name}` };
    }
  } catch (e) {
    review.push(`  overpass error for "${name}": ${(e as Error).message}`);
  }
  return null;
}

interface Hit {
  lat: number;
  lng: number;
  label: string;
}

async function geocode(p: Raw): Promise<{ lat: number; lng: number } | null> {
  const name: string = p.name;
  const conv = (h: { r: NominatimResult; q: string } | null): Hit | null =>
    h && { lat: h.r.lat, lng: h.r.lng, label: `[${h.q}] -> ${h.r.class}/${h.r.type} ${h.r.displayName}` };
  let hit: Hit | null = null;
  const s = simplified(p.address);
  if (p.onGrounds) {
    const qs = [`${name}, University of Virginia, Charlottesville`, `${name}, Charlottesville, Virginia`];
    if (s) qs.unshift(s);
    hit = conv(await firstHit(qs));
    for (const a of ALIASES[p.id] ?? []) {
      if (hit) break;
      hit = conv(await firstHit([a]));
    }
    hit ??= await overpassByName(name);
  } else {
    hit = conv(await firstHit([p.address]));
    if (!hit && s) hit = conv(await firstHit([s]));
    if (!hit && p.kind === "apartment_complex") hit = conv(await firstHit([`${name}, Charlottesville, Virginia`]));
  }
  if (!hit) return null;
  review.push(`  ${p.id} (${name}) -> ${hit.lat},${hit.lng} ${hit.label}`);
  return { lat: round5(hit.lat), lng: round5(hit.lng) };
}

/** Extra OSM name queries for on-Grounds options whose research addresses are descriptions. */
const ALIASES: Record<string, string[]> = {
  "p-brown-college": ["Gibbons House, University of Virginia", "Brown College, University of Virginia", "Brown Residential College, Charlottesville"],
  "p-copeley-apartments": ["Copeley Apartments, Charlottesville", "Copeley Hill Apartments, University of Virginia"],
  "p-faulkner-apartments": ["Faulkner Apartments, Charlottesville", "Faulkner Apartments, University of Virginia", "Hench Apartments, University of Virginia"],
  "p-gaston-ramazani-houses": ["Gaston House, University of Virginia", "Ramazani House, University of Virginia"],
  "p-international-residential-college": ["International Residential College, Charlottesville", "Munford House, University of Virginia", "Gwathmey House, University of Virginia"],
  "p-lambeth-field-apartments": ["Lambeth Field Apartments, Charlottesville", "Lambeth Field, University of Virginia"],
  "p-maison-francaise": ["Maison Francaise, University of Virginia", "French House, University of Virginia, Charlottesville"],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const TERMS = ["12_month", "academic_year", "semester", "other"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function main() {
  const batches: Raw[] = [];
  for (const k of "ABCDEFGHI") batches.push(JSON.parse(await readFile(join(HERE, "research", `${k}.json`), "utf8")));

  const props = new Map<string, Raw>();
  const plansByProp = new Map<string, Raw[]>();
  const landlords = new Map<string, Raw>();
  const llAlias = new Map<string, string>();
  const llByName = new Map<string, string>();
  const accessibility: Raw[] = [];

  // Duplicates: p-cherry-suites (E kept, F dropped), p-ivy-gardens (D's p-ivy-garden kept: own site).
  const DUP_OF: Record<string, string> = { "p-ivy-gardens": "p-ivy-garden" };

  for (const b of batches) {
    for (const l of b.landlords) {
      const nm = norm(l.name);
      const canon = landlords.has(l.id) ? l.id : (llByName.get(nm) ?? l.id);
      llAlias.set(l.id, canon);
      if (!landlords.has(canon)) {
        landlords.set(canon, { ...l, id: canon });
        llByName.set(nm, canon);
      } else {
        const cur = landlords.get(canon)!;
        for (const [k, v] of Object.entries(l)) if (k !== "id" && cur[k] == null) cur[k] = v;
        if (canon !== l.id) drop(`landlord ${l.id}`, `duplicate of ${canon} (same name)`);
      }
    }
    const accepted = new Set<string>();
    for (const p of b.properties) {
      if (props.has(p.id) || DUP_OF[p.id]) {
        drop(`property ${p.id}`, `duplicate of ${DUP_OF[p.id] ?? p.id} (better-sourced copy kept); its floor plans dropped`);
        continue;
      }
      props.set(p.id, p);
      accepted.add(p.id);
      plansByProp.set(p.id, []);
    }
    for (const f of b.floorPlans) if (accepted.has(f.propertyId)) plansByProp.get(f.propertyId)!.push(f);
    accessibility.push(...b.accessibility);
  }

  const outProps: Property[] = [];
  const outPlans: FloorPlan[] = [];
  const usedPlanIds = new Set<string>();

  for (const id of [...props.keys()].sort()) {
    const { unknownAmenities: _u, ...p } = props.get(id)!;
    p.slug = id.replace(/^p-/, "");
    if (p.onGrounds) {
      p.kind = "on_grounds";
      if (!p.onGroundsInfo?.hrlUrl) {
        drop(`property ${id}`, "on-Grounds without onGroundsInfo.hrlUrl");
        continue;
      }
    } else p.onGrounds = false;
    if (typeof p.neighborhood !== "string" || !p.neighborhood.trim()) {
      drop(`property ${id}`, "empty neighborhood");
      continue;
    }
    if (p.landlordId) p.landlordId = llAlias.get(p.landlordId) ?? p.landlordId;
    if (p.landlordId && !landlords.has(p.landlordId)) {
      drop(`property ${id}`, `landlord ${p.landlordId} missing`);
      continue;
    }

    const plans: FloorPlan[] = [];
    for (const f of plansByProp.get(id) ?? []) {
      const { unknown: _x, ...fp } = f;
      const why = !(fp.rentAmount > 0)
        ? "rentAmount not > 0"
        : !(Number.isInteger(fp.beds) && fp.beds >= 0 && fp.beds <= 8)
          ? `beds invalid (${fp.beds})`
          : !(fp.baths >= 1)
            ? `baths invalid (${fp.baths})`
            : !DATE.test(fp.leaseStart ?? "") || !DATE.test(fp.leaseEnd ?? "")
              ? "lease dates missing"
              : !(fp.leaseEnd > fp.leaseStart)
                ? "leaseEnd not after leaseStart"
                : !TERMS.includes(fp.termKind)
                  ? `bad termKind ${fp.termKind}`
                  : !["individual", "joint"].includes(fp.leaseType)
                    ? `bad leaseType ${fp.leaseType}`
                    : !["per_bed", "per_unit"].includes(fp.rentBasis)
                      ? `bad rentBasis ${fp.rentBasis}`
                      : usedPlanIds.has(fp.id)
                        ? "duplicate floor plan id"
                        : null;
      if (why) {
        drop(`floor plan ${f.id}`, why);
        continue;
      }
      usedPlanIds.add(fp.id);
      plans.push({ ...fp, propertyId: id } as FloorPlan);
    }
    if (!plans.length) {
      drop(`property ${id}`, "no valid floor plans");
      continue;
    }

    const loc = await geocode(p);
    if (!loc) {
      drop(`property ${id}`, `no OSM geocode (${p.address}); floor plans dropped`);
      continue;
    }
    p.location = loc;
    outProps.push(p as Property);
    outPlans.push(...plans);
  }

  if (!outProps.some((p) => p.id === "p-verve-charlottesville")) drop("VERVE", "MISSING from output");

  const surv = new Set(outProps.map((p) => p.id));
  const usedLl = new Set(outProps.map((p) => p.landlordId).filter(Boolean));
  const outLandlords = [...landlords.values()].filter((l) => usedLl.has(l.id)) as Landlord[];
  for (const l of landlords.values()) if (!usedLl.has(l.id)) drop(`landlord ${l.id}`, "no surviving property");

  const photos: Photo[] = outProps.map((p) => {
    const verve = p.id === "p-verve-charlottesville";
    return {
      id: `ph-${p.slug}-1`,
      propertyId: p.id,
      url: verve ? "/placeholder/rendering.svg" : "/placeholder/building.svg",
      alt: verve ? "VERVE Charlottesville rendering (placeholder)" : `${p.name} exterior (placeholder)`,
      isRendering: verve,
      ratingCount: 0,
    };
  });
  const outAcc = accessibility.filter((a) => surv.has(a.propertyId)) as AccessibilityInfo[];

  const byId = <T extends { id: string }>(a: T[]) => a.sort((x, y) => (x.id < y.id ? -1 : 1));
  const write = (n: string, v: unknown) => writeFile(join(SEED, n), JSON.stringify(v, null, 2) + "\n", "utf8");
  await write("properties.json", byId(outProps));
  await write("floor_plans.json", byId(outPlans));
  await write("landlords.json", byId(outLandlords));
  await write("photos.json", byId(photos));
  await write(
    "accessibility.json",
    outAcc.sort((a, b) => (a.propertyId < b.propertyId ? -1 : 1)),
  );

  console.log("Geocode hits (review):\n" + review.join("\n"));
  console.log("\nDropped:\n" + dropped.map((d) => "  " + d).join("\n"));
  const on = outProps.filter((p) => p.onGrounds).length;
  console.log(
    `\nSummary: properties ${outProps.length} (off-Grounds ${outProps.length - on}, on-Grounds ${on}), floor plans ${outPlans.length}, landlords ${outLandlords.length}, photos ${photos.length}, accessibility ${outAcc.length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
