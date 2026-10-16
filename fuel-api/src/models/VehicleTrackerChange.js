import { DataTypes } from 'sequelize';

export const RELINK_STATUSES = ['pending', 'synced', 'failed', 'not_applicable'];

/**
 * One row per tracker change on a vehicle: what mileage was carried forward, and whether the vehicle's
 * maintenance schedules (which Traccar attaches to a device) were re-linked to the new tracker. The
 * relink is an external call that can fail after the assignment committed; recording its outcome here
 * makes it retryable instead of silently leaving the vehicle without its schedules.
 *
 * SQL twin: migrations/20261016_vehicle_owned_odometer.sql.
 */
export default (sequelize) => {
  const VehicleTrackerChange = sequelize.define(
    'VehicleTrackerChange',
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
      fromDeviceId: { type: DataTypes.INTEGER, allowNull: true, field: 'from_device_id' },
      toDeviceId: { type: DataTypes.INTEGER, allowNull: true, field: 'to_device_id' },
      fromAssignmentId: { type: DataTypes.UUID, allowNull: true, field: 'from_assignment_id' },
      toAssignmentId: { type: DataTypes.UUID, allowNull: true, field: 'to_assignment_id' },
      anchorId: { type: DataTypes.UUID, allowNull: true, field: 'anchor_id' },
      gapId: { type: DataTypes.UUID, allowNull: true, field: 'gap_id' },
      carriedOdometerKm: { type: DataTypes.DOUBLE, allowNull: true, field: 'carried_odometer_km' },
      changedAt: { type: DataTypes.DATE, allowNull: false, field: 'changed_at' },
      actorUserId: { type: DataTypes.INTEGER, allowNull: true, field: 'actor_user_id' },
      maintenanceRelinkStatus: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'pending',
        field: 'maintenance_relink_status',
        validate: { isIn: [RELINK_STATUSES] },
      },
      maintenanceRelinkError: { type: DataTypes.TEXT, allowNull: true, field: 'maintenance_relink_error' },
      maintenanceMoved: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'maintenance_moved' },
    },
    {
      tableName: 'vehicle_tracker_changes',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_vehicle_tracker_changes_vehicle', fields: ['vehicle_id', { name: 'changed_at', order: 'DESC' }] },
        {
          name: 'idx_vehicle_tracker_changes_relink',
          fields: ['maintenance_relink_status'],
          where: { maintenance_relink_status: ['pending', 'failed'] },
        },
      ],
    },
  );

  return VehicleTrackerChange;
};
