import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Permission = sequelize.define(
    'Permission',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
      },
      category: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'permissions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );

  return Permission;
};
