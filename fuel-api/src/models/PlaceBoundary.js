import { DataTypes } from 'sequelize';

export const PLACE_LEVELS = ['province', 'district', 'municipality', 'city', 'town', 'suburb'];
export const PLACE_VALIDATION = ['valid', 'repaired', 'location_only'];

/**
 * Zambian place catalogue behind "Search boundary" — reference data, not tenant data. The geometry is exactly
 * what the UI previews and saves to Traccar. SQL twin: migrations/20261018_place_boundaries.sql (CI builds the
 * schema from this model; production from the SQL, so the two must be kept in step).
 */
export default (sequelize) => {
  const PlaceBoundary = sequelize.define(
    'PlaceBoundary',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      source: { type: DataTypes.STRING(24), allowNull: false },
      sourceId: { type: DataTypes.STRING(64), allowNull: false, field: 'source_id' },
      sourceVersion: { type: DataTypes.STRING(96), allowNull: false, field: 'source_version' },
      sourceUrl: { type: DataTypes.TEXT, allowNull: true, field: 'source_url' },
      license: { type: DataTypes.STRING(96), allowNull: false },
      attribution: { type: DataTypes.TEXT, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false },
      nameNorm: { type: DataTypes.STRING(160), allowNull: false, field: 'name_norm' },
      altNames: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'alt_names' },
      altNorms: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'alt_norms' },
      level: { type: DataTypes.STRING(16), allowNull: false, validate: { isIn: [PLACE_LEVELS] } },
      province: { type: DataTypes.STRING(64), allowNull: true },
      geometryType: { type: DataTypes.STRING(16), allowNull: false, field: 'geometry_type', validate: { isIn: [['Polygon', 'Point']] } },
      validationStatus: { type: DataTypes.STRING(16), allowNull: false, field: 'validation_status', validate: { isIn: [PLACE_VALIDATION] } },
      geometry: { type: DataTypes.JSONB, allowNull: false },
      centroidLon: { type: DataTypes.DOUBLE, allowNull: false, field: 'centroid_lon' },
      centroidLat: { type: DataTypes.DOUBLE, allowNull: false, field: 'centroid_lat' },
      areaKm2: { type: DataTypes.DOUBLE, allowNull: true, field: 'area_km2' },
      vertices: { type: DataTypes.INTEGER, allowNull: true },
      originalVertices: { type: DataTypes.INTEGER, allowNull: true, field: 'original_vertices' },
      originalAreaKm2: { type: DataTypes.DOUBLE, allowNull: true, field: 'original_area_km2' },
      maxDeviationM: { type: DataTypes.INTEGER, allowNull: true, field: 'max_deviation_m' },
      notes: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
      importedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'imported_at' },
    },
    {
      tableName: 'place_boundaries',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'place_boundaries_source_unique', unique: true, fields: ['source', 'source_id'] },
        { name: 'idx_place_boundaries_name_norm', fields: ['name_norm'], where: { is_active: true } },
        { name: 'idx_place_boundaries_level', fields: ['level'], where: { is_active: true } },
      ],
    },
  );
  return PlaceBoundary;
};
