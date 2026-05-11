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
    name: {
      type: DataTypes.STRING(120),
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
      type: DataTypes.ENUM('active', 'closed'),
      allowNull: false,
      defaultValue: 'active',
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
    fuelStationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Optional fuel_stations.id',
    },
    stationName: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'Denormalized station label for display',
    },
  }, {
    tableName: 'operation_sessions',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['sessionDate'] },
      { fields: ['status'] },
    ],
  });

  return OperationSession;
};
