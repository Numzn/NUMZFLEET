/**
 * Build the committed Zambian place catalogue from raw sources.
 *
 *   node src/scripts/buildPlaceCatalogue.js --sources <dir> [--out <file>]
 *
 * <dir> holds what scripts/geo/fetch_place_sources.sh and extract_osm_places.py produce
 * (gb-ADM1/2.geojson + .meta.json, optional osm-places.geojson + osm.meta.json, SHA256SUMS).
 * Output is deterministic (no timestamps), so a refresh shows up as a reviewable git diff.
 * No database and no network: loading it into Postgres is importPlaceBoundaries.js.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildGeoBoundariesRows, buildOsmRows, sortRows } from '../modules/geofences/catalogueBuild.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(here, '../modules/geofences/catalogue/zambia-places.catalogue.json');
const ALIASES = path.resolve(here, '../modules/geofences/catalogue/aliases.json');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const main = () => {
  const dir = arg('sources');
  if (!dir) throw new Error('usage: buildPlaceCatalogue.js --sources <dir> [--out <file>]');
  const out = arg('out') || DEFAULT_OUT;
  const gb = (f) => path.join(dir, f);

  const aliases = readJson(ALIASES);
  delete aliases._comment;
  const gbBuilt = buildGeoBoundariesRows({
    adm1: readJson(gb('gb-ADM1.geojson')),
    adm2: readJson(gb('gb-ADM2.geojson')),
    meta: { ADM1: readJson(gb('gb-ADM1.meta.json')), ADM2: readJson(gb('gb-ADM2.meta.json')) },
    aliases,
  });
  let rows = [...gbBuilt.rows];
  const skipped = [...gbBuilt.skipped];

  const osmFile = gb('osm-places.geojson');
  let osmMeta = null;
  if (fs.existsSync(osmFile)) {
    osmMeta = readJson(gb('osm.meta.json'));
    const osm = buildOsmRows({
      osm: readJson(osmFile),
      provinces: gbBuilt.provinces,
      version: osmMeta.version,
      sourceUrl: osmMeta.sourceUrl,
    });
    rows = rows.concat(osm.rows);
    skipped.push(...osm.skipped);
  }

  const checksums = fs.existsSync(gb('SHA256SUMS'))
    ? Object.fromEntries(fs.readFileSync(gb('SHA256SUMS'), 'utf8').trim().split('\n').map((l) => l.split(/\s+/).reverse()))
    : {};
  const catalogue = {
    schema: 1,
    sources: {
      geoboundaries: { ADM1: readJson(gb('gb-ADM1.meta.json')).boundaryID, ADM2: readJson(gb('gb-ADM2.meta.json')).boundaryID, license: 'CC BY 4.0' },
      ...(osmMeta ? { osm: { version: osmMeta.version, license: 'ODbL 1.0' } } : {}),
    },
    checksums,
    places: sortRows(rows),
  };
  fs.writeFileSync(out, `${JSON.stringify(catalogue)}\n`);

  const count = (pred) => rows.filter(pred).length;
  console.log(JSON.stringify({
    out,
    bytes: fs.statSync(out).size,
    places: rows.length,
    provinces: count((r) => r.level === 'province'),
    districts: count((r) => r.level === 'district'),
    townPolygons: count((r) => ['city', 'town', 'municipality'].includes(r.level) && r.geometryType === 'Polygon'),
    townLocationsOnly: count((r) => ['city', 'town', 'municipality'].includes(r.level) && r.geometryType === 'Point'),
    skipped,
  }, null, 1));
};

main();
