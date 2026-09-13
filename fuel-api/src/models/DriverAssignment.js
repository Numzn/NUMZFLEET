import { DataTypes } from 'sequelize';

/**
 * Links a fleet vehicle (Postgres) to a NUMZFLEET driver (Postgres) — the
 * authoritative Driver ↔ Vehicle relationship. Mirrors DeviceAssignment.js's
 * own shape deliberately: "change driver" deactivates the current row and
 * inserts a new one rather than overwriting driverId in place, so history
 * survives the same way device history does.
 *
 * This does not reference Traccar's device id. The corresponding Traccar
 * device ↔ driver link (tc_device_driver) is a synchronized projection kept
 * by the service layer, using the vehicle's own device_assignments row —
 * never read back through this model.
 */
export default (sequelize) => {
  const DriverAssignment = sequelize.define(
    'DriverAssignment',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      vehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'vehicle_id',
        references: { model: 'vehicles', key: 'id' },
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'driver_id',
        references: { model: 'drivers', key: 'id' },
      },
      assignedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'assigned_at',
      },
      unassignedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'unassigned_at',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_active',
      },
    },
    {
      tableName: 'driver_assignments',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['vehicleId'] },
        { fields: ['driverId'] },
        { fields: ['isActive'] },
      ],
    },
  );

  return DriverAssignment;
};
