# @homed/data

Hand-curated UVA housing catalog. `seed/` is the dataset the app runs on; `fixtures/` is a tiny
stable dataset for tests (lead-owned). Everything in `seed/` is `dataStatus: "unverified_seed"`:
assembled from public websites on 2026-10-19, not yet verified by hand. Map data (c) OpenStreetMap
contributors (ODbL).

## Provenance
- `buildings.json`, `landmarks.json`: OpenStreetMap via Overpass (`scripts/build-buildings.ts`,
  `scripts/build-landmarks.ts`). Entrance = `entrance=main` node when present, else the centroid.
- `majors.json`: informed estimate of where each major's courses meet; not registrar data.
- `properties.json`, `floor_plans.json`, `landlords.json`: read from public property/manager pages and
  UVA Housing & Residence Life (on-Grounds). Each property's `source` lists the URLs read and notes
  inferred lease dates, lowest-of-range prices and unpublished lease liability. Raw batches live in
  `scripts/research/*.json`; `scripts/merge-research.ts` dedupes, geocodes (Nominatim, cached) and writes the seed.
  Some pins are street or area centroids where OSM has no building object for the address.
- `photos.json`: placeholders only (VERVE: rendering placeholder). No landlord photos are copied.
- `accessibility.json`: empty; only publicly stated facts are allowed and none were found yet.
- `walk_times.json`: property x (building + landmark) matrix from OSRM foot routing, or an estimate.

## Refresh
```
npx tsx packages/data/scripts/build-buildings.ts
npx tsx packages/data/scripts/build-landmarks.ts
npx tsx packages/data/scripts/merge-research.ts      # after editing scripts/research/*.json
npx tsx packages/data/scripts/walk-times.ts          # regenerate the matrix
npx tsx packages/data/scripts/walk-times.ts --check  # offline completeness check
npx tsx packages/data/scripts/validate.ts            # full integrity report
npx vitest run packages/data
```
OSM clients are rate-limited to 1 request/second with a descriptive User-Agent and cache under
`scripts/.cache/` (gitignored).

## Walk times with a self-hosted OSRM
```
# Virginia extract from Geofabrik
curl -LO https://download.geofabrik.de/north-america/us/virginia-latest.osm.pbf
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-extract -p /opt/foot.lua /data/virginia-latest.osm.pbf
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-partition /data/virginia-latest.osrm
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-customize /data/virginia-latest.osrm
docker run -p 5000:5000 -v "$PWD:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/virginia-latest.osrm
OSRM_URL=http://localhost:5000 npx tsx packages/data/scripts/walk-times.ts
```
Without `OSRM_URL` the script tries the public `routing.openstreetmap.de/routed-foot` server politely,
and falls back to a straight-line estimate (haversine x 1.3 / 80 m per minute) on any error.
Bus minutes: 3 walk + 5 wait + ride at 18 km/h over straight-line x 1.4 + 3 walk, kept only if it
beats walking by >= 3 minutes.
