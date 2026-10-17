// Regenerate the real-data test fixture from the built catalogue:
//   node scripts/geo/make_fixture.mjs [catalogue.json]
// Picks the rows the search tests assert on, unmodified (geometry included).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const modules = path.resolve(here, '../../src/modules/geofences');
const src = process.argv[2] || path.join(modules, 'catalogue/zambia-places.catalogue.json');
const catalogue = JSON.parse(fs.readFileSync(src, 'utf8'));

const NAMES = new Set(['Chipata', 'Lusaka', 'Kabwe', 'Livingstone', 'Kitwe', 'Ndola', 'Eastern', 'Central', 'Kanyama', 'Kalumbila']);
const places = catalogue.places
  .filter((p) => NAMES.has(p.name))
  .map((p, i) => ({ ...p, id: `fixture-${i}` }));
fs.writeFileSync(path.join(modules, 'fixtures/places.fixture.json'), `${JSON.stringify({ sources: catalogue.sources, places })}\n`);
console.log(places.map((p) => `${p.source}/${p.level}/${p.geometryType}/${p.name}`).join('\n'));
