import { DataTypes } from 'sequelize';

export const ANCHOR_KINDS = [
  'observation',
  'tracker_replacement',
  'tracker_removal',
  'assignment_start',
  'legacy_migration',
  'reset_reconciliation',
  'correction',
];

/**
 * physically_verified  a person confirmed a dashboard reading (the ONLY state a human attestation sets)
 * trusted_estimate     the system accepted a value without physical confirmation (consistent tracker
 *                      readings, or "trust the live reading"); never labelled physically verified
 * provisional          carried onto a replacement tracker; its relationship to the baseline is not
 *                      established yet
 * awaiting_tracker     the new tracker has not reported since the anchor was set (no counter reference)
 * legacy_unverified    migrated from the device-keyed vehicle_specs anchor; unverifiable provenance
 */
export const ANCHOR_STATES = [
  'physically_verified',
  'trusted_estimate',
  'provisional',
  'awaiting_tracker',
  'legacy_unverified',
];

/**
 * The vehicle's accepted mileage baseline and its audit history (append-only: a change inserts a new row
 * and supersedes the previous one; nothing is overwritten). Exactly one row per vehicle is current
 * (superseded_at IS NULL). The tracker supplies evidence; the vehicle owns the mileage.
 *
 * The SQL twin is migrations/20261016_vehicle_owned_odometer.sql. vehicleOwnedOdometerMigration.test.js
 * fails if the two ever describe different columns.
 */
export default (sequelize) => {
  const VehicleOdometerAnchor = sequelize.define(
    'VehicleOdometerAnchor',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      vehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'vehicle_id',
        references: { model: 'vehicles', key: 'id' },
        onDelete: 'CASCADE',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
        onDelete: 'CASCADE',
      },
      deviceId: { type: DataTypes.INTEGER, allowNull: true, field: 'device_id' },
      deviceAssignmentId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'device_assignment_id',
        references: { model: 'device_assignments', key: 'id' },
        onDelete: 'SET NULL',
      },
      odometerKm: { type: DataTypes.DOUBLE, allowNull: false, field: 'odometer_km' },
      telemetryKm: { type: DataTypes.DOUBLE, allowNull: true, field: 'telemetry_km' },
      telemetryAt: { type: DataTypes.DATE, allowNull: true, field: 'telemetry_at' },
      previousOdometerKm: { type: DataTypes.DOUBLE, allowNull: true, field: 'previous_odometer_km' },
      previousAnchorId: { type: DataTypes.UUID, allowNull: true, field: 'previous_anchor_id' },
      kind: { type: DataTypes.STRING(32), allowNull: false, validate: { isIn: [ANCHOR_KINDS] } },
      state: { type: DataTypes.STRING(32), allowNull: false, validate: { isIn: [ANCHOR_STATES] } },
      source: { type: DataTypes.STRING(32), allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: true },
      actorUserId: { type: DataTypes.INTEGER, allowNull: true, field: 'actor_user_id' },
      observedAt: { type: DataTypes.DATE, allowNull: false, field: 'observed_at' },
      evidence: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      supersededAt: { type: DataTypes.DATE, allowNull: true, field: 'superseded_at' },
      supersededByAnchorId: { type: DataTypes.UUID, allowNull: true, field: 'superseded_by_anchor_id' },
    },
    {
      tableName: 'vehicle_odometer_anchors',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          name: 'ux_vehicle_odometer_anchors_current',
          unique: true,
          fields: ['vehicle_id'],
          where: { superseded_at: null },
        },
        { name: 'idx_vehicle_odometer_anchors_history', fields: ['vehicle_id', { name: 'created_at', order: 'DESC' }] },
        { name: 'idx_vehicle_odometer_anchors_device', fields: ['device_id'] },
      ],
    },
  );

  return VehicleOdometerAnchor;
};
