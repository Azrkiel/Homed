/**
 * Builds packages/data/seed/buildings.json from OpenStreetMap (Overpass) data.
 *
 * Run:  npx tsx packages/data/scripts/build-buildings.ts
 *
 * All network access goes through ./osm.ts (1 req/s, disk cache in scripts/.cache),
 * so a second run is fully offline. Output is sorted by id and deterministic.
 * Every row comes from an OSM element; the tables below only choose which
 * elements to keep and give display names / UVA codes to them.
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inBbox, overpass } from "./osm.js";

type Kind = "academic" | "library" | "recreation" | "other";
interface Building {
  id: string;
  code: string;
  name: string;
  entrance: { lat: number; lng: number };
  kind: Kind;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = any;

// Grounds + medical campus + North Grounds (Darden/Law) + Fontaine.
const AREA = "(38.00,-78.55,38.07,-78.47)";
const SELECT = `
  nwr["building"~"^(university|college|hospital|school)$"]["name"]${AREA};
  nwr["amenity"~"^(library|university)$"]["name"]${AREA};
  nwr["leisure"~"^(sports_centre|fitness_centre)$"]["name"]${AREA};
  nwr["building"]["name"~"Aquatic and Fitness|Observatory Mountain|Aerospace Research Laboratory"]${AREA};
`;
const QUERY_BUILDINGS = `[out:json][timeout:120];
(${SELECT});
out body center;`;
const QUERY_ENTRANCES = `[out:json][timeout:120];
(${SELECT})->.b;
node(w.b)["entrance"];
out;`;

/** Non-"university" OSM elements that are nevertheless UVA academic/library/rec buildings. */
const EXTRA = new Set([
  "w44528406", // Rice Hall (building=school)
  "w341688937", // Jesser Hall
  "w44528451", // Wilsdorf Hall
  "w44528212", // Faulkner House / Miller Center
  "w889297488", // Ruffin Hall
  "w44528462", // Aquatic and Fitness Center
  "w44528477", // Aerospace Research Laboratory
  "w44528715", // Observatory Mountain Engineering Research Facility
  "w676194705", // Law Grounds
  "w676195987", // Darden Library
  "w676196016", // Darden School of Business
  "w44528505", // Brown Hall (Law)
  "n8942441849", // Arthur J. Morris Law Library
  "n367988049", // Albert and Shirley Small Special Collections Library
  "n367988317", // Fiske Kimball Fine Arts Library
  "n570088901", // Scholars' Lab
]);

const EXCLUDE_NAME =
  /Portal|Parking|Garage|Warehouse|Greenhouse|Quonset|Storage|Print and Mail|Food Center|^Stores |^Hotel [A-F]\b|Monroe Hill Houses|Pavillion|^\d|^University of Virginia$|Emergency Management|Dining|Houses$|Graduate Housing|Residential College/i;

interface Override {
  name?: string;
  code?: string;
  kind?: Kind;
  id?: string;
}
const OVERRIDES: Record<string, Override> = {
  r330904: { id: "b-thornton", code: "THN" },
  w44528563: { id: "b-rouss-robertson", code: "RRH", name: "Rouss & Robertson Halls" },
  w44528141: { id: "b-clemons", code: "CLEM", kind: "library" },
  w44528325: { code: "OLS" },
  w44528406: { code: "RIC" },
  r4167951: { code: "MON" },
  w44528558: { code: "GIL" },
  w44528749: { code: "CHM" },
  w273581534: { code: "PLS" },
  w44528404: { code: "PHY" },
  w44528119: { code: "KER" },
  w44528482: { code: "HAL" },
  w153041025: { code: "NAU" },
  w153041024: { code: "GIB" },
  w339366929: { code: "CAB" },
  w339366931: { code: "WIL" },
  w44528176: { code: "CAM", name: "Campbell Hall" },
  w44528335: { code: "RUF", name: "Ruffner Hall" }, // OSM old_name "Ruffner Hall"; current name Ridley Hall
  w339366926: { code: "BRY" },
  w44528589: { code: "CLK" },
  r4866579: { code: "SHA", kind: "library" }, // Shannon Library (formerly Alderman Library)
  w44528512: { code: "MG", kind: "recreation" },
  w344842958: { code: "MCL", name: "McLeod Hall" },
  w240403215: { code: "CMNEB" },
  w44528421: { code: "MEC" },
  w44528592: { code: "GAR", name: "Garrett Hall (Batten School)" },
  w676194705: { code: "LAW", name: "School of Law" },
  w676196016: { code: "DAR", name: "Darden School of Business" },
  w344842947: { name: "Pinn Hall (Jordan Hall)", code: "PIN" },
  w1291005629: { code: "SDS" },
  w44528718: { kind: "recreation" },
  w44528462: { kind: "recreation" },
  w44528080: { kind: "recreation" },
  w344842960: { code: "UVAH" },
  w44528354: { code: "MRBF", kind: "academic" },
  w44528527: { name: "Elson Building" },
  w44528490: { name: "National Radio Astronomy Observatory (Stone Hall)" },
  r9390079: { name: "Alumni Hall" },
};

const STOP = new Set(["of", "and", "the", "for", "at", "building", "hall", "school"]);

function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s+-\s+University of Virginia$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function kindOf(tags: Record<string, string>, name: string): Kind {
  if (tags.amenity === "library" || /Library|Scholars' Lab|Ivy Stacks/i.test(name)) return "library";
  if (
    tags.leisure === "sports_centre" ||
    tags.leisure === "fitness_centre" ||
    /Gymnasium|Recreation|Aquatic|Fitness|Arena|Stadium/i.test(name)
  )
    return "recreation";
  if (
    tags.building === "hospital" ||
    /Hospital|Clinic|Cancer Center|Surgery|Health Center|Medical Office|Primary Care|Museum|Press|Student Activities|Newcomb|Madison Hall|Hunter Smith Band|President|Office of|Davis|Commons|Corner|Booker|Brody|Rotunda|Amphitheatre|Alumni|Contemplative|International Center|Stores/i.test(
      name,
    )
  )
    return "other";
  return "academic";
}

function codeCandidates(name: string): string[] {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const sig = words.filter((w) => !STOP.has(w.toLowerCase()));
  const w = (sig.length ? sig : words).map((x) => x.toUpperCase());
  const out: string[] = [];
  const first = w[0] ?? "BLD";
  out.push(first.slice(0, 3));
  out.push(first.slice(0, 4));
  if (w.length > 1) out.push(w.map((x) => x[0]).join("").slice(0, 5));
  out.push(first.slice(0, 5));
  if (w.length > 1) {
    out.push(first.slice(0, 2) + w[1]!.slice(0, 2));
    out.push(first.slice(0, 3) + w[1]!.slice(0, 2));
  }
  const all = w.join("");
  for (let i = 3; i <= 5; i++) out.push(all.slice(0, i - 1) + all.slice(i, i + 1));
  return out.map((c) => c.replace(/[^A-Z]/g, "")).filter((c) => c.length >= 3 && c.length <= 5);
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

async function main(): Promise<void> {
  // Sequential on purpose: one OSM request at a time.
  const bRes = await overpass(QUERY_BUILDINGS);
  const eRes = await overpass(QUERY_ENTRANCES);
  const els: El[] = bRes.elements;
  const entranceNodes = new Map<number, El>();
  for (const n of eRes.elements as El[]) if (n.type === "node") entranceNodes.set(n.id, n);

  interface Cand {
    key: string;
    el: El;
    name: string;
    lat: number;
    lng: number;
  }
  const cands: Cand[] = [];
  for (const el of els) {
    const tags: Record<string, string> = el.tags ?? {};
    const key = `${el.type[0]}${el.id}`;
    const name = cleanName(tags.name ?? "");
    if (!name) continue;
    const core = /^(university|college|hospital)$/.test(tags.building ?? "");
    if (!core && !EXTRA.has(key)) continue;
    if (EXCLUDE_NAME.test(name) && !OVERRIDES[key]) continue;

    // Prefer an entrance=main node on a way; else the element centroid.
    let lat: number | undefined;
    let lng: number | undefined;
    if (el.type === "way") {
      const mains = ((el.nodes ?? []) as number[])
        .map((id) => entranceNodes.get(id))
        .filter((n): n is El => !!n && n.tags?.entrance === "main")
        .sort((a, b) => a.id - b.id);
      if (mains[0]) {
        lat = mains[0].lat;
        lng = mains[0].lon;
      }
    }
    if (lat === undefined || lng === undefined) {
      const c = el.type === "node" ? el : el.center;
      if (!c) continue;
      lat = c.lat;
      lng = c.lon;
    }
    cands.push({ key, el, name: OVERRIDES[key]?.name ?? name, lat: lat!, lng: lng! });
  }

  // Rouss + Robertson are one row: average the two OSM centroids.
  const robertson = cands.find((c) => c.key === "w341343965");
  const rouss = cands.find((c) => c.key === "w44528563");
  if (rouss && robertson) {
    rouss.lat = (rouss.lat + robertson.lat) / 2;
    rouss.lng = (rouss.lng + robertson.lng) / 2;
  }
  const filtered = cands.filter((c) => c.key !== "w341343965");

  // Deterministic order, drop duplicate names (keep lowest key).
  filtered.sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  const seenNames = new Set<string>();
  const unique = filtered.filter((c) => {
    const k = c.name.toLowerCase();
    if (seenNames.has(k)) return false;
    seenNames.add(k);
    return true;
  });

  const usedCodes = new Set<string>();
  for (const c of unique) {
    const code = OVERRIDES[c.key]?.code;
    if (code) {
      if (usedCodes.has(code)) throw new Error(`duplicate override code ${code}`);
      usedCodes.add(code);
    }
  }

  const out: Building[] = [];
  const usedIds = new Set<string>();
  for (const c of unique) {
    const ov = OVERRIDES[c.key] ?? {};
    const tags: Record<string, string> = c.el.tags ?? {};
    let code = ov.code;
    if (!code) {
      code = codeCandidates(c.name).find((x) => !usedCodes.has(x));
      if (!code) throw new Error(`no code for ${c.name}`);
      usedCodes.add(code);
    }
    const id = ov.id ?? `b-${kebab(c.name)}`;
    if (usedIds.has(id)) throw new Error(`duplicate id ${id}`);
    usedIds.add(id);
    const lat = round5(c.lat);
    const lng = round5(c.lng);
    if (!inBbox(lat, lng)) continue;
    out.push({ id, code, name: c.name, entrance: { lat, lng }, kind: ov.kind ?? kindOf(tags, c.name) });
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "seed", "buildings.json");
  await writeFile(dest, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`wrote ${out.length} buildings -> ${dest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
