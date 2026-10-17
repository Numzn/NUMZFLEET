/**
 * Load the committed place catalogue into Postgres (idempotent).
 *
 *   node src/scripts/importPlaceBoundaries.js [--file <catalogue.json>] [--dry-run]
 *
 * Needs the 20261018_place_boundaries.sql migration. Safe to re-run at any time; see
 * docs/GEOFENCE_BOUNDARY_CATALOGUE.md.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Op } from 'sequelize';
import { importCatalogue } from '../modules/geofences/catalogueImport.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.resolve(here, '../modules/geofences/catalogue/zambia-places.catalogue.json');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};

const main = async () => {
  const file = arg('file') || DEFAULT_FILE;
  const dryRun = process.argv.includes('--dry-run');
  const catalogue = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { PlaceBoundary } = await import('../models/index.js');
  const sequelize = (await import('../config/database.js')).default;

  const store = {
    findAll: (sources) => PlaceBoundary.findAll({ where: { source: { [Op.in]: sources } } }),
    create: (row) => PlaceBoundary.create(row),
    update: (record, patch) => record.update(patch),
  };
  const summary = await importCatalogue(catalogue.places, store, { dryRun });
  console.log(JSON.stringify({ file, dryRun, sources: catalogue.sources, ...summary }, null, 1));
  await sequelize.close();
  process.exit(summary.rejected.length ? 2 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
