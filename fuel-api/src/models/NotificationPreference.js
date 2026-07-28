import { DataTypes } from 'sequelize';

export default (sequelize) => sequelize.define(
  'NotificationPreference',
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
    channel: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'notification_preferences',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
