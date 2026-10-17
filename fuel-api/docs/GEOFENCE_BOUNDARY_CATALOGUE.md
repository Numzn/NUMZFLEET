# Zambian geofence boundary catalogue

How "Search boundary" on the Geofences page finds a real boundary for a Zambian town, district or province — and what it does honestly when none exists.

## Why it exists (root cause of the original problem)

The first version of Search boundary asked the public Nominatim service on every search and kept only results that came back as polygons. That fails for Zambia for a data reason, not a code bug:

- In OpenStreetMap almost every Zambian town and city (Chipata, Kabwe, Livingstone, Kitwe, Ndola, Matero, Mandevu, …) is mapped as a **single point (a node)**. Nominatim can only return an outline for objects that have one.
- The administrative polygons that *do* exist are districts and provinces. Because point results were discarded, a search for "Lusaka" showed only **Lusaka Province** (about 23,000 km²) — a boundary far larger than the town, offered with nothing to say so.
- Nothing distinguished a town from a district from a province, nothing explained that a town had no outline, and every search depended on a public service that asks not to be used this way.

## What it does now

```
Search text
   │
   ▼
local catalogue (place_boundaries, Postgres)  ── match by name / alternative name
   │  found                                      │ nothing known by that name
   ▼                                             ▼
ranked, labelled results                    live Nominatim lookup (fallback only)
 town/city/municipality boundary  (if one exists)
 district boundary                (labelled "larger than the town")
 province boundary                (labelled)
 location-only towns              ("no verified boundary")
   │
   ▼
user chooses: verified boundary │ radius zone around a location │ draw by hand
   │
   ▼
preview = saved geometry  →  Traccar geofence (unchanged integration)
```

- A **town boundary is only ever recommended when a verified town polygon exists.** A district is never pre-selected as if it were the town.
- A **location-only** place (a point) offers a **radius zone**: a real Traccar `CIRCLE`, named and labelled as a radius zone (`attributes.numzZone = radius`), never described as the town's boundary. Radius 100 m – 50 km.
- **Manual drawing is unchanged** and is always offered when no town boundary exists.
- The preview is the geometry that is saved: catalogue outlines are validated and simplified **at build time** with the same code the save path uses, so what is stored, previewed and written to Traccar is one and the same ring. (A radius zone previews as a 96-sided polygon; Traccar stores and tests the exact circle.)

## Data sources and licences

| Source | Used for | Licence | Attribution kept |
|---|---|---|---|
| [geoBoundaries](https://www.geoboundaries.org/) gbOpen ZMB ADM1 / ADM2 (upstream: Zambia Data Hub; GRID3 / Office of the Surveyor General) | 10 provinces, 116 districts | CC BY 4.0 | per row (`license`, `attribution`) and shown under the search results |
| [Geofabrik Zambia extract](https://download.geofabrik.de/africa/zambia.html) of OpenStreetMap | town/city polygons where OSM has them; town/city points as location-only | ODbL 1.0, © OpenStreetMap contributors | per row, shown under the search results |
| [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) public service | **fallback only**, for names the catalogue does not know | data ODbL; service usage policy applies | marked "live lookup" |

Review points before wider distribution (not legal advice):

- **ODbL share-alike.** The OSM-derived rows of the catalogue are a *derivative database* of OpenStreetMap. Using them inside NUMZFLEET is fine with attribution; if the catalogue file or table were **published or redistributed**, those rows would have to be offered under ODbL. Keep the OSM rows identifiable (`source = 'osm'`) so they can be separated.
- **CC BY 4.0** requires attribution (done) and an indication that the geometry was modified: boundaries here are *simplified* (see `original_vertices`, `max_deviation_m`).
- **Nominatim policy.** No bulk or systematic use, a real `User-Agent`, at most 1 request/second, results cached. The app only calls it as a fallback, serialised at ≥ 1.1 s spacing, cached for 24 h, and limited to 20 searches/minute per user. Nothing downloads datasets at request time.

## Data model

Table `place_boundaries` (migration `20261018_place_boundaries.sql`, model `PlaceBoundary`). Identity is `(source, source_id)`. Per row: name, alternative names (+ normalised forms for matching), `level` (province / district / municipality / city / town), `province`, `geometry_type` (Polygon / Point), `validation_status` (valid / repaired / location_only), the saved `geometry`, centroid, `area_km2`, `vertices`, `original_vertices`, `original_area_km2`, `max_deviation_m`, `notes` (what the single saved ring leaves out), source version/URL, licence, attribution, `is_active`.

It is **reference data**: no company data, no foreign keys, never read or written by any other feature. User-created geofences live in Traccar and the importer can never touch them.

## Building and refreshing the catalogue

Two deliberately separate steps, so production never downloads anything:

**1. Build (on a developer machine, occasionally).** Produces the committed file `src/modules/geofences/catalogue/zambia-places.catalogue.json`. Output is deterministic (no timestamps), so a refresh is a reviewable git diff.

```bash
cd fuel-api
scripts/geo/fetch_place_sources.sh place-sources            # geoBoundaries + Geofabrik (~250 MB), checksum-verified
python3 -m venv .venv && .venv/bin/pip install osmium shapely
.venv/bin/python scripts/geo/extract_osm_places.py place-sources/zambia-latest.osm.pbf place-sources/osm-places.geojson
node src/scripts/buildPlaceCatalogue.js --sources place-sources
node scripts/geo/make_fixture.mjs                           # refresh the real-data test fixture if rows changed
```

`place-sources/` is git-ignored; never commit the raw sources.

**2. Load (any environment, idempotent).**

```bash
node src/scripts/importPlaceBoundaries.js --dry-run         # what would change
node src/scripts/importPlaceBoundaries.js                   # apply
```

- Re-running creates no duplicates and changes nothing that has not changed.
- A place that disappears from a source is **deactivated**, never deleted, and returns if it reappears.
- Rows are re-validated on load (closed ring, valid coordinates, no self-intersection, fits Traccar's 4096-character area column, licence present); rejects are listed and the command exits 2.
- Nothing here touches geofences, vehicles or any other table.

## What is and is not in the catalogue

See the build summary printed by `buildPlaceCatalogue.js`. In short: provinces and districts come only from geoBoundaries; towns/cities come only from OpenStreetMap and only as a polygon where OSM actually has one, otherwise as a **location**. Nothing is buffered, hulled or otherwise invented. Gaps are listed in the delivery report.

Geometry limits that apply to every boundary (Traccar stores `POLYGON` / `CIRCLE` / `LINESTRING` only, single ring, `lat lon` order, 4096 characters):

- a place with several separate areas is saved as its **largest area only**, and the UI states how much area was left out;
- inner holes are **filled in**, and the UI says so;
- outlines are simplified to fit; `max_deviation_m` is an upper bound on how far any dropped point lay from the saved outline;
- self-intersecting or empty source geometry is never stored.

## Deploy and rollback

1. Deploy is the normal pipeline. The migration is **additive only** (`CREATE TABLE IF NOT EXISTS`) and passes the deploy safety guard; it runs before the new images are pulled.
2. After the deploy, load the catalogue once: `docker exec numzfleet-prod-fuel-api node src/scripts/importPlaceBoundaries.js`.
3. Until the import is run — or if the table is missing — search degrades to the live Nominatim lookup instead of failing.

Rollback:

- **Code:** redeploy the previous image. The previous release ignores the table.
- **Data:** `fuel-api/migrations-rollback/20261018_place_boundaries.down.sql` renames the table aside (not dropped). Geofences already saved from it live in Traccar and are unaffected; the catalogue can be rebuilt any time by re-running the import.
