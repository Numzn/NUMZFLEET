/**
 * Read access to the place catalogue. Metadata (no geometry — a district outline
 * is tens of KB) is cached in memory for a few minutes so a search is not a
 * table scan; geometry is fetched only for the handful of rows being returned.
 * The loader is injected so tests never touch a database.
 */
const METADATA_ATTRIBUTES = [
  'id', 'source', 'sourceId', 'name', 'nameNorm', 'altNames', 'altNorms', 'level', 'province', 'geometryType',
  'validationStatus', 'centroidLon', 'centroidLat', 'areaKm2', 'vertices', 'originalVertices', 'maxDeviationM',
  'notes', 'license', 'attribution', 'isActive',
];

export const createPlaceRepository = (loadModel, { ttlMs = 10 * 60 * 1000, now = Date.now } = {}) => {
  let cache = null;

  return {
    async listMetadata() {
      if (cache && now() - cache.at < ttlMs) return cache.rows;
      const model = await loadModel();
      const found = await model.findAll({ where: { isActive: true }, attributes: METADATA_ATTRIBUTES, raw: true });
      cache = { at: now(), rows: found };
      return found;
    },

    /** @returns {Promise<Map<string, object>>} row id -> GeoJSON geometry */
    async getGeometries(ids) {
      const out = new Map();
      if (!ids.length) return out;
      const model = await loadModel();
      const found = await model.findAll({ where: { id: ids }, attributes: ['id', 'geometry'], raw: true });
      found.forEach((r) => out.set(r.id, r.geometry));
      return out;
    },

    clear() {
      cache = null;
    },
  };
};
