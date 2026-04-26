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
    ],
  });

  return OperationSessionRefuel;
};
