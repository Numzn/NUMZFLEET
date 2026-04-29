import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const OperationSessionRefuel = sequelize.define('OperationSessionRefuel', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Operation session id',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Traccar user who created this record',
    },
    vehicleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Vehicle identifier used by operation sessions UI',
    },
    fuelCost: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    fuelAmount: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    estimatedFuelLitres: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    actualFuelLitres: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    varianceLitres: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    variancePercent: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('normal', 'warning', 'flagged', 'incomplete'),
      allowNull: false,
      defaultValue: 'normal',
    },
    erbPricePerLitre: {
      type: DataTypes.DOUBLE,
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
    tankLevelStart: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    tankCapacitySnapshot: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    meterFuelLitres: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    meterVariance: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    locked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    currentMileage: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    attendant: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    pumpNumber: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    sessionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'operation_session_refuels',
    timestamps: true,
    indexes: [
      { fields: ['sessionId'] },
      { fields: ['vehicleId'] },
      { fields: ['sessionDate'] },
      { fields: ['sessionId', 'vehicleId'] },
    ],
  });

  return OperationSessionRefuel;
};
