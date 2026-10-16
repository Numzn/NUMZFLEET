import { DataTypes } from 'sequelize';

export const READING_EVENT_TYPES = [
  'quarantined', 'spike_discarded', 'level_shift_accepted', 'reset_accepted', 'rollover', 'unit_corrected', 'span',
];
export const READING_EVENT_STATUSES = ['info', 'open', 'resolved'];

/**
 * The audit log of notable decisions made while accepting tracker readings. 'open' marks a quarantine that has
 * not yet been recognised as a spike or confirmed as a new level. SQL twin:
 * migrations/20261017_accepted_mileage_readings.sql.
 */
export default (sequelize) => {
  const MileageReadingEvent = sequelize.define(
    'MileageReadingEvent',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      vehicleId: {
        type: DataTypes.UUID, allowNull: false, field: 'vehicle_id',
        references: { model: 'vehicles', key: 'id' }, onDelete: 'CASCADE',
      },
      companyId: {
        type: DataTypes.UUID, allowNull: false, field: 'company_id',
        references: { model: 'companies', key: 'id' }, onDelete: 'CASCADE',
      },
      deviceId: { type: DataTypes.INTEGER, allowNull: false, field: 'device_id' },
      deviceAssignmentId: { type: DataTypes.UUID, allowNull: true, field: 'device_assignment_id' },
      type: { type: DataTypes.STRING(32), allowNull: false, validate: { isIn: [READING_EVENT_TYPES] } },
      reason: { type: DataTypes.STRING(24), allowNull: true },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'info', validate: { isIn: [READING_EVENT_STATUSES] } },
      jumpKm: { type: DataTypes.DOUBLE, allowNull: true, field: 'jump_km' },
      acceptedKm: { type: DataTypes.DOUBLE, allowNull: true, field: 'accepted_km' },
      fromFix: { type: DataTypes.DATE, allowNull: true, field: 'from_fix' },
      toFix: { type: DataTypes.DATE, allowNull: true, field: 'to_fix' },
      positionId: { type: DataTypes.BIGINT, allowNull: true, field: 'position_id' },
      detail: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: 'mileage_reading_events',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_mileage_reading_events_vehicle', fields: ['vehicle_id', { name: 'created_at', order: 'DESC' }] },
        { name: 'idx_mileage_reading_events_device', fields: ['device_id', { name: 'created_at', order: 'DESC' }] },
        { name: 'idx_mileage_reading_events_open', fields: ['device_id'], where: { status: 'open' } },
      ],
    },
  );

  return MileageReadingEvent;
};
