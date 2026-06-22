import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const OperationUnlock = sequelize.define('OperationUnlock', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    operationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unlockedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unlockedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'operation_unlocks',
    updatedAt: false,
    indexes: [{ fields: ['operationId'] }],
  });

  return OperationUnlock;
};
