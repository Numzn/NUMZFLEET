import { DataTypes } from 'sequelize';

export const VEHICLE_COMPLIANCE_TYPES = Object.freeze([
  'ROUTINE_SERVICE',
  'INSURANCE',
  'ROAD_TAX',
  'FITNESS',
  'FIRE_EXTINGUISHER',
  'INSPECTION',
  'PERMIT',
  'LICENSE',
]);

export const VEHICLE_COMPLIANCE_STATUSES = Object.freeze([
  'VALID',
  'UPCOMING',
  'DUE',
  'OVERDUE',
  'EXPIRED',
  'UNKNOWN',
]);

export default (sequelize) => {
  const VehicleCompliance = sequelize.define(
    'VehicleCompliance',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      fleetVehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'fleet_vehicle_id',
        references: { model: 'vehicles', key: 'id' },
      },
      type: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'due_date',
      },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'VALID',
      },
      reminderLeadDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
        field: 'reminder_lead_days',
      },
      documentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'document_id',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: 'vehicle_compliance',
      timestamps: true,
      indexes: [
        { fields: ['company_id', 'fleet_vehicle_id'] },
        { fields: ['company_id', 'type'] },
        { fields: ['company_id', 'status'] },
      ],
    },
  );

  return VehicleCompliance;
};
