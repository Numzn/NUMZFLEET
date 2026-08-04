import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const UserRole = sequelize.define(
    'UserRole',
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
      },
      roleId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'role_id',
        references: { model: 'roles', key: 'id' },
      },
      // Nullable — a Platform Super Admin's assignment has no company.
      companyId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
      },
    },
    {
      tableName: 'user_roles',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );

  return UserRole;
};
