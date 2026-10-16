import { DataTypes } from 'sequelize';

/**
 * The remembered, ACCEPTED state of one tracker's counter: what the vehicle-facing counter reads, the raw
 * watermark the next reading is compared to, how far through Traccar's positions (arrival order) we have
 * read, and any quarantined readings waiting to be recognised as a spike or confirmed as a new level.
 *
 * An operational cache, not history: it is rebuilt from the next reading if lost, and replaced when the
 * tracker moves to another vehicle. SQL twin: migrations/20261017_accepted_mileage_readings.sql.
 */
export default (sequelize) => {
  const TrackerCounterState = sequelize.define(
    'TrackerCounterState',
    {
      deviceId: { type: DataTypes.INTEGER, primaryKey: true, field: 'device_id' },
      vehicleId: {
        type: DataTypes.UUID, allowNull: false, field: 'vehicle_id',
        references: { model: 'vehicles', key: 'id' }, onDelete: 'CASCADE',
      },
      companyId: {
        type: DataTypes.UUID, allowNull: false, field: 'company_id',
        references: { model: 'companies', key: 'id' }, onDelete: 'CASCADE',
      },
      deviceAssignmentId: {
        type: DataTypes.UUID, allowNull: true, field: 'device_assignment_id',
        references: { model: 'device_assignments', key: 'id' }, onDelete: 'SET NULL',
      },
      acceptedKm: { type: DataTypes.DOUBLE, allowNull: false, field: 'accepted_km' },
      rawKm: { type: DataTypes.DOUBLE, allowNull: false, field: 'raw_km' },
      attribute: { type: DataTypes.STRING(16), allowNull: true },
      bootstrapAcceptedKm: { type: DataTypes.DOUBLE, allowNull: false, field: 'bootstrap_accepted_km' },
      appliedKm: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0, field: 'applied_km' },
      fixTime: { type: DataTypes.DATE, allowNull: false, field: 'fix_time' },
      positionCursor: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'position_cursor' },
      positionId: { type: DataTypes.BIGINT, allowNull: true, field: 'position_id' },
      pending: { type: DataTypes.JSONB, allowNull: true },
      quarantinedTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'quarantined_total' },
      bootstrappedAt: { type: DataTypes.DATE, allowNull: false, field: 'bootstrapped_at' },
      lastIngestedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_ingested_at' },
    },
    {
      tableName: 'tracker_counter_state',
      timestamps: true,
      underscored: true,
      indexes: [{ name: 'idx_tracker_counter_state_vehicle', fields: ['vehicle_id'] }],
    },
  );

  return TrackerCounterState;
};
