import { DataTypes } from 'sequelize';

export default (sequelize) => sequelize.define(
  'PushSubscription',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    numzUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'numz_user_id',
      references: { model: 'numz_users', key: 'id' },
      onDelete: 'CASCADE',
    },
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    p256dh: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    auth: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    userAgent: {
      type: DataTypes.STRING(512),
      allowNull: true,
      field: 'user_agent',
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_used_at',
    },
    // Phase 6: 'active' | 'expired'. The push service reporting a subscription
    // gone (404/410, RFC 8030) deactivates the row rather than deleting it —
    // see pushSubscriptionsRepository.js's removeByEndpoint.
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    },
    deactivatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deactivated_at',
    },
    deactivationReason: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'deactivation_reason',
    },
  },
  {
    tableName: 'push_subscriptions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
