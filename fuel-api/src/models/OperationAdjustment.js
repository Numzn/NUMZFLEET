import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const OperationAdjustment = sequelize.define('OperationAdjustment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    operationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    refuelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    field: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    originalValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    newValue: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'operation_adjustments',
    updatedAt: false,
    indexes: [{ fields: ['operationId'] }],
  });

  return OperationAdjustment;
};
