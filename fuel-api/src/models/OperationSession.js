import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const OperationSession = sequelize.define('OperationSession', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Traccar user ID of session owner',
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'company_id',
      references: { model: 'companies', key: 'id' },
    },
    calendarDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    reference: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'Human-friendly Fuel Day reference, e.g. FD-20260621-001',
    },
    fleetTimezone: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'Africa/Lusaka',
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    stationName: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    sessionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'approved', 'locked'),
      allowNull: false,
      defaultValue: 'draft',
    },
    approvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approvedFuelPrice: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    approvedDieselPrice: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    approvedPetrolPrice: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    approvedBudget: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    approvedLitres: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    approvalVarianceExists: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    totalEstimatedFuel: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    totalActualFuel: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    totalEstimatedCost: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    totalActualCost: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    totalVarianceCost: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    totalsFrozenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'operation_sessions',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['calendarDate'] },
      { fields: ['status'] },
      { unique: true, fields: ['userId', 'calendarDate'] },
    ],
  });

  return OperationSession;
};
