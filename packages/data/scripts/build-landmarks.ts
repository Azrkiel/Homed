/**
 * Builds packages/data/seed/landmarks.json from OpenStreetMap (Overpass) data.
 *
 * Run:  npx tsx packages/data/scripts/build-landmarks.ts
 *
 * All network access goes through ./osm.ts (1 req/s, disk cache in scripts/.cache),
 * so a second run is fully offline. Output is sorted by id and deterministic.
 * Every row comes from an OSM element (node position or way/relation center);
 * the table below only picks which elements to keep and gives ids / kinds.
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inBbox, overpass } from "./osm.js";

type Kind = "social" | "library" | "dining" | "gym" | "grocery" | "worship" | "health" | "other";
interface Landmark {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  kind: Kind;
  tradition?: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = any;

interface Pick {
  id: string;
  kind: Kind;
  /** Display name; defaults to the OSM name. */
  name?: string;
  /** Only when OSM has no religion/denomination tag that says it. */
  tradition?: string;
}

/** OSM element key (n/w/r + id) -> landmark row. */
const PICKS: Record<string, Pick> = {
  // Required core.
  w339379987: { id: "lawn", kind: "other" }, // The Lawn (park)
  w737101352: { id: "corner", kind: "social" }, // The Corner (quarter)
  w44528141: { id: "clemons", kind: "library" },
  w44528295: { id: "newcomb", kind: "social" },
  w44528462: { id: "afc", kind: "gym", name: "Aquatic & Fitness Center" },
  w44528718: { id: "slaughter-rec", kind: "gym", name: "Slaughter Recreation Center" },
  w44528577: { id: "ngrc", kind: "gym" },
  n1931415595: { id: "grocery-barracks-kroger", kind: "grocery", name: "Kroger (Barracks Road Shopping Center)" },
  n2692149345: {
    id: "grocery-barracks-harris-teeter",
    kind: "grocery",
    name: "Harris Teeter (Barracks Road Shopping Center)",
  },
  w517817443: { id: "uva-hospital", kind: "health", name: "UVA Hospital" },

  // Other groceries.
  n2159403447: { id: "grocery-trader-joes", kind: "grocery" },
  w314048805: { id: "grocery-whole-foods", kind: "grocery" },
  n2717133016: { id: "grocery-foods-of-all-nations", kind: "grocery" },
  n2633347584: { id: "grocery-corner-grocery", kind: "grocery" },
  w391760457: { id: "grocery-wegmans", kind: "grocery" },

  // Dining.
  w44528179: { id: "dining-observatory-hill", kind: "dining", name: "Observatory Hill Dining Hall" },
  w44528590: { id: "dining-runk", kind: "dining", name: "Runk Dining Hall" },

  // Libraries.
  r4866579: { id: "library-shannon", kind: "library" },
  n367988049: { id: "library-small-special-collections", kind: "library" },
  n367988317: { id: "library-fiske-kimball", kind: "library" },
  w344842944: { id: "library-claude-moore", kind: "library" },

  // Worship, within ~2.5 km of the Rotunda.
  w44528532: { id: "worship-university-chapel", kind: "worship", tradition: "Christian" },
  w264230381: {
    id: "worship-st-pauls-memorial-church",
    kind: "worship",
    name: "St. Paul's Memorial Church",
    tradition: "Christian (Episcopal)", // OSM name says Episcopal; no denomination tag
  },
  w448368617: { id: "worship-brody-jewish-center", kind: "worship", tradition: "Jewish" }, // OSM: building=university, no religion tag
  w676432170: { id: "worship-chabad-on-the-corner", kind: "worship" },
  w240440552: { id: "worship-st-thomas-aquinas", kind: "worship", name: "St. Thomas Aquinas Catholic Church" },
  w676197697: { id: "worship-wesley-memorial", kind: "worship" },
  w264228029: { id: "worship-university-baptist", kind: "worship" },
  w676185421: { id: "worship-westminster-presbyterian", kind: "worship" },
  w676185299: { id: "worship-trinity-episcopal", kind: "worship", tradition: "Christian (Episcopal)" },
  w382396947: { id: "worship-islamic-society-cva", kind: "worship" },
  w395709788: { id: "worship-an-noor-islamic-center", kind: "worship" },
  w676721964: { id: "worship-unitarian-universalist", kind: "worship" },
  w389457243: { id: "worship-temple-beth-israel", kind: "worship" },
  w676197537: { id: "worship-st-mark-lutheran", kind: "worship", name: "St. Mark Lutheran Church" },
  w389457168: { id: "worship-christ-episcopal", kind: "worship", tradition: "Christian (Episcopal)" },
  w389457169: { id: "worship-holy-comforter", kind: "worship" },
  w396518839: { id: "worship-friends-meeting", kind: "worship" },
  w676431661: { id: "worship-zion-union-baptist", kind: "worship" },
};

const ROTUNDA = { lat: 38.03564, lng: -78.50339 }; // OSM r4809573 (Rotunda) centre
const WORSHIP_RADIUS_M = 2500;

const TITLE: Record<string, string> = {
  catholic: "Catholic",
  roman_catholic: "Catholic",
  baptist: "Baptist",
  methodist: "Methodist",
  presbyterian: "Presbyterian",
  lutheran: "Lutheran",
  episcopal: "Episcopal",
  anglican: "Episcopal",
  quaker: "Quaker",
  greek_orthodox: "Greek Orthodox",
  seventh_day_adventist: "Seventh-day Adventist",
};

function traditionOf(tags: Record<string, string>): string | undefined {
  const rel = (tags.religion ?? "").toLowerCase();
  const den = (tags.denomination ?? "").toLowerCase();
  if (rel === "jewish") return "Jewish";
  if (rel === "muslim") return "Muslim";
  if (rel === "unitarian_universalist" || den === "unitarian_universalist") return "Unitarian Universalist";
  if (rel === "christian") {
    const d = TITLE[den];
    return d ? `Christian (${d})` : "Christian";
  }
  if (rel) return rel.charAt(0).toUpperCase() + rel.slice(1);
  return undefined;
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const TYPE: Record<string, string> = { n: "node", w: "way", r: "relation" };

async function main(): Promise<void> {
  const ids: Record<string, number[]> = { n: [], w: [], r: [] };
  for (const key of Object.keys(PICKS).sort()) ids[key[0]!]!.push(Number(key.slice(1)));
  const parts = Object.entries(ids)
    .filter(([, v]) => v.length)
    .map(([t, v]) => `${TYPE[t]}(id:${v.join(",")});`);
  const query = `[out:json][timeout:120];\n(${parts.join("")});\nout tags center;`;
  const res = await overpass(query);

  const byKey = new Map<string, El>();
  for (const el of res.elements as El[]) byKey.set(`${el.type[0]}${el.id}`, el);

  const out: Landmark[] = [];
  const seen = new Set<string>();
  for (const [key, pick] of Object.entries(PICKS)) {
    const el = byKey.get(key);
    if (!el) throw new Error(`OSM element ${key} (${pick.id}) not returned by Overpass`);
    const tags: Record<string, string> = el.tags ?? {};
    const c = el.type === "node" ? el : el.center;
    if (!c) throw new Error(`no position for ${key}`);
    const location = { lat: round5(c.lat), lng: round5(c.lon) };
    if (!inBbox(location.lat, location.lng)) throw new Error(`${pick.id} outside bbox`);
    if (seen.has(pick.id)) throw new Error(`duplicate id ${pick.id}`);
    seen.add(pick.id);

    const name = pick.name ?? (tags.name ?? "").replace(/\s+/g, " ").trim();
    if (!name) throw new Error(`no name for ${key}`);
    const row: Landmark = { id: pick.id, name, location, kind: pick.kind };
    if (pick.kind === "worship") {
      if (metres(ROTUNDA, location) > WORSHIP_RADIUS_M) throw new Error(`${pick.id} too far from the Rotunda`);
      const t = pick.tradition ?? traditionOf(tags);
      if (!t) throw new Error(`no tradition for ${key}`);
      row.tradition = t;
    }
    out.push(row);
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "seed", "landmarks.json");
  await writeFile(dest, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`wrote ${out.length} landmarks -> ${dest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
