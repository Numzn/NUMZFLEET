import { DataTypes } from 'sequelize';

export const GAP_KINDS = ['tracker_replacement', 'no_tracker', 'tracker_offline', 'counter_reset'];
export const GAP_STATUSES = ['open', 'closed_unobserved', 'resolved'];

/**
 * An interval whose distance was never observed: from the last accepted evidence of the previous
 * source to the first valid evidence of the next one. The distance inside it is UNKNOWN -- it is
 * recorded, never estimated -- and stays so ('open' / 'closed_unobserved') until a physical observation
 * quantifies it ('resolved').
 *
 * SQL twin: migrations/20261016_vehicle_owned_odometer.sql.
 */
export default (sequelize) => {
  const VehicleMileageGap = sequelize.define(
    'VehicleMileageGap',
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
      kind: { type: DataTypes.STRING(32), allowNull: false, validate: { isIn: [GAP_KINDS] } },
      fromDeviceId: { type: DataTypes.INTEGER, allowNull: true, field: 'from_device_id' },
      toDeviceId: { type: DataTypes.INTEGER, allowNull: true, field: 'to_device_id' },
      startedAt: { type: DataTypes.DATE, allowNull: false, field: 'started_at' },
      endedAt: { type: DataTypes.DATE, allowNull: true, field: 'ended_at' },
      lastOdometerKm: { type: DataTypes.DOUBLE, allowNull: true, field: 'last_odometer_km' },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'open',
        validate: { isIn: [GAP_STATUSES] },
      },
      resolvedByAnchorId: { type: DataTypes.UUID, allowNull: true, field: 'resolved_by_anchor_id' },
    },
    {
      tableName: 'vehicle_mileage_gaps',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_vehicle_mileage_gaps_vehicle', fields: ['vehicle_id', { name: 'started_at', order: 'DESC' }] },
        { name: 'idx_vehicle_mileage_gaps_open', fields: ['vehicle_id'], where: { status: 'open' } },
      ],
    },
  );

  return VehicleMileageGap;
};
