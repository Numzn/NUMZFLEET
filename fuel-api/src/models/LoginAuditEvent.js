import { DataTypes } from 'sequelize';

export default (sequelize) => sequelize.define(
  'LoginAuditEvent',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    traccarUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'traccar_user_id',
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'company_id',
      references: { model: 'companies', key: 'id' },
      onDelete: 'SET NULL',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    outcome: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    method: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'password',
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent',
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'occurred_at',
    },
  },
  {
    tableName: 'login_audit_events',
    timestamps: false,
  },
);
