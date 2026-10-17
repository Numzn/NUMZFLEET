-- NUMZFLEET Zambian place catalogue: the boundaries "Search boundary" offers when a fleet manager creates a
-- geofence. Reference data only -- it holds no company data and nothing here is read by, or written to, any
-- existing table. Geofences themselves are still created in Traccar by the client, exactly as before.
--
--   place_boundaries   one row per (source, source_id): a province / district / town boundary imported from
--                      geoBoundaries or OpenStreetMap, or a location-only town (a point, no outline). The
--                      geometry stored is the one that will be previewed AND saved: already validated and
--                      simplified to fit Traccar's 4096-character geofence area column. Licence and
--                      attribution travel with every row.
--
-- Populated by `node src/scripts/importPlaceBoundaries.js` (idempotent: re-running updates in place, and a
-- place that disappears from the source is deactivated, never deleted). See docs/GEOFENCE_BOUNDARY_CATALOGUE.md.
--
-- ADDITIVE ONLY. Recovery: migrations-rollback/20261018_place_boundaries.down.sql (renames the table aside).

BEGIN;

CREATE TABLE IF NOT EXISTS place_boundaries (
  id UUID PRIMARY KEY,
  source VARCHAR(24) NOT NULL,
  source_id VARCHAR(64) NOT NULL,
  source_version VARCHAR(96) NOT NULL,
  source_url TEXT,
  license VARCHAR(96) NOT NULL,
  attribution TEXT NOT NULL,
  name VARCHAR(160) NOT NULL,
  -- Lower-cased, accent-free forms of name + alt_names, used for matching only.
  name_norm VARCHAR(160) NOT NULL,
  alt_names JSONB NOT NULL DEFAULT '[]',
  alt_norms JSONB NOT NULL DEFAULT '[]',
  -- province | district | municipality | city | town | suburb
  level VARCHAR(16) NOT NULL,
  province VARCHAR(64),
  -- Polygon | Point
  geometry_type VARCHAR(16) NOT NULL,
  -- valid | repaired | location_only. Only 'valid'/'repaired' rows carry a polygon; invalid source geometry is
  -- never stored (it is counted in the import summary instead).
  validation_status VARCHAR(16) NOT NULL,
  -- The saved outline (GeoJSON Polygon, lon,lat) or the location (GeoJSON Point).
  geometry JSONB NOT NULL,
  centroid_lon DOUBLE PRECISION NOT NULL,
  centroid_lat DOUBLE PRECISION NOT NULL,
  area_km2 DOUBLE PRECISION,
  vertices INTEGER,
  original_vertices INTEGER,
  original_area_km2 DOUBLE PRECISION,
  max_deviation_m INTEGER,
  -- What the single saved ring leaves out: { droppedParts, droppedHoles, droppedAreaPct, simplified }.
  notes JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT place_boundaries_source_unique UNIQUE (source, source_id),
  CONSTRAINT place_boundaries_level_check CHECK (level IN ('province', 'district', 'municipality', 'city', 'town', 'suburb')),
  CONSTRAINT place_boundaries_geometry_type_check CHECK (geometry_type IN ('Polygon', 'Point')),
  CONSTRAINT place_boundaries_validation_check CHECK (validation_status IN ('valid', 'repaired', 'location_only'))
);

CREATE INDEX IF NOT EXISTS idx_place_boundaries_name_norm ON place_boundaries (name_norm) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_place_boundaries_level ON place_boundaries (level) WHERE is_active;

COMMIT;
