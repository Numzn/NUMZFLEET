import { DataTypes } from 'sequelize';

/**
 * One PHYSICAL send: a single destination, on a single try.
 *
 * Push is the reason this level exists — one logical push delivery fans out to
 * every registered subscription, so "user 17, three devices" is one delivery
 * with three attempts, never three notifications. Retries also land here, which
 * is what makes "how many attempts, and what did the provider say each time"
 * answerable instead of a counter that overwrites itself.
 *
 * targetId is intentionally NOT a foreign key: pushChannel.js hard-deletes an
 * expired subscription (RFC 8030), and the evidence of what was attempted must
 * outlive the subscription row.
 */
export default (sequelize) => sequelize.define(
  'NotificationDeliveryAttempt',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    deliveryId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'delivery_id',
      references: { model: 'notification_deliveries', key: 'id' },
      onDelete: 'CASCADE',
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id',
    },
    attemptNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'attempt_number',
    },
    targetType: { type: DataTypes.STRING(32), allowNull: true, field: 'target_type' },
    targetId: { type: DataTypes.UUID, allowNull: true, field: 'target_id' },
    idempotencyKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'idempotency_key',
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'pending',
    },
    provider: { type: DataTypes.STRING(32), allowNull: true },
    providerMessageId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'provider_message_id',
    },
    failureCode: { type: DataTypes.STRING(64), allowNull: true, field: 'failure_code' },
    failureReason: { type: DataTypes.TEXT, allowNull: true, field: 'failure_reason' },
    startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
    completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
  },
  {
    tableName: 'notification_delivery_attempts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
