import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const UserNotification = sequelize.define(
    'UserNotification',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id',
      },
      type: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'system',
      },
      severity: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'info',
      },
      title: {
        type: DataTypes.STRING(512),
        allowNull: false,
        defaultValue: '',
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      source: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'fuel-api',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      archived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      viewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'viewed_at',
      },
      acknowledgedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'acknowledged_at',
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'resolved_at',
      },
      clientDedupKey: {
        type: DataTypes.STRING(512),
        allowNull: true,
        field: 'client_dedup_key',
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'company_id',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    },
    {
      tableName: 'notifications',
      timestamps: true,
    },
  );

  return UserNotification;
};
