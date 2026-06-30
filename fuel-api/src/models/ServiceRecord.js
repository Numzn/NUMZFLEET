import { DataTypes } from 'sequelize';

export const SERVICE_RECORD_STATUSES = [
  'open',
  'scheduled',
  'in_progress',
  'awaiting_parts',
  'completed',
  'cancelled',
];

export const SERVICE_RECORD_ACTIVE_STATUSES = ['open', 'scheduled', 'in_progress', 'awaiting_parts'];

export const SERVICE_RECORD_PRIORITIES = ['low', 'medium', 'high'];

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
    /** Legacy NOT NULL column — mirror deviceId on create until column is dropped. */
    deprecatedVehicleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: '_deprecated_vehicleId',
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
    workOrderNumber: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    priority: {
      type: DataTypes.STRING(8),
      allowNull: true,
      defaultValue: 'medium',
    },
    workshop: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    assignee: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    estimatedCost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    actualCost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    labourCost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    partsCost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    otherCost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    scheduledDueDate: {
      type: DataTypes.DATE,
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
