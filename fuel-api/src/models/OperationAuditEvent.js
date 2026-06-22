import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const OperationAuditEvent = sequelize.define('OperationAuditEvent', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    operationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    eventType: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    tableName: 'operation_audit_events',
    updatedAt: false,
    indexes: [
      { fields: ['operationId'] },
      { fields: ['eventType'] },
    ],
  });

  return OperationAuditEvent;
};
