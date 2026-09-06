import { DataTypes } from 'sequelize';

/**
 * One LOGICAL delivery: this notification, to this recipient, on this channel.
 * Identity is (notificationId, channel) — retries and per-device push fan-out
 * live in notification_delivery_attempts, so this row stays stable.
 *
 * Note the tenant attribute is `companyId` here, matching Vehicle/NumzUser/
 * ServiceRecord/Role. UserNotification's `tenantId` is a legacy outlier.
 */
export default (sequelize) => sequelize.define(
  'NotificationDelivery',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    notificationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'notification_id',
      references: { model: 'notifications', key: 'id' },
      onDelete: 'CASCADE',
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id',
    },
    recipientUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'recipient_user_id',
    },
    channel: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'pending',
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'attempt_count',
    },
    queuedAt: { type: DataTypes.DATE, allowNull: true, field: 'queued_at' },
    lastAttemptAt: { type: DataTypes.DATE, allowNull: true, field: 'last_attempt_at' },
    sentAt: { type: DataTypes.DATE, allowNull: true, field: 'sent_at' },
    deliveredAt: { type: DataTypes.DATE, allowNull: true, field: 'delivered_at' },
    failedAt: { type: DataTypes.DATE, allowNull: true, field: 'failed_at' },
    // Phase 3 worker fields — present so async delivery needs no schema change.
    nextAttemptAt: { type: DataTypes.DATE, allowNull: true, field: 'next_attempt_at' },
    lockedAt: { type: DataTypes.DATE, allowNull: true, field: 'locked_at' },
    lockedBy: { type: DataTypes.STRING(64), allowNull: true, field: 'locked_by' },
    failureCode: { type: DataTypes.STRING(64), allowNull: true, field: 'failure_code' },
    failureReason: { type: DataTypes.TEXT, allowNull: true, field: 'failure_reason' },
  },
  {
    tableName: 'notification_deliveries',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['notification_id', 'channel'] }],
  },
);
