import { DataTypes } from 'sequelize';

export const SERVICE_RECORD_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'];

export default (sequelize) => {
  const ServiceRecord = sequelize.define('ServiceRecord', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fleetVehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'vehicles', key: 'id' },
    },
    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Traccar device id at time of service (for odometer anchor)',
    },
    maintenanceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'open',
    },
    odometerKm: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    cost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    vendor: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dueAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'service_records',
    indexes: [
      { fields: ['companyId', 'fleetVehicleId'] },
      { fields: ['status'] },
    ],
  });

  return ServiceRecord;
};
