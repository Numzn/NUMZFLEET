import { DataTypes } from 'sequelize';

/**
 * Links a fleet vehicle (Postgres) to a Traccar device (integer id in tc_devices).
 * deviceId must always match Traccar's device primary key — never IMEI as the key.
 */
export default (sequelize) => {
  const DeviceAssignment = sequelize.define(
    'DeviceAssignment',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      vehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'vehicles', key: 'id' },
        onDelete: 'RESTRICT',
      },
      /** Traccar tc_devices.id (integer) — not a SQL FK to MySQL */
      deviceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assignedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      unassignedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'device_assignments',
      timestamps: true,
      indexes: [
        { fields: ['vehicleId'] },
        { fields: ['deviceId'] },
        { fields: ['isActive'] },
      ],
    },
  );

  return DeviceAssignment;
};
