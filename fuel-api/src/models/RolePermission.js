import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const RolePermission = sequelize.define(
    'RolePermission',
    {
      roleId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: 'role_id',
        references: { model: 'roles', key: 'id' },
      },
      permissionId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: 'permission_id',
        references: { model: 'permissions', key: 'id' },
      },
    },
    {
      tableName: 'role_permissions',
      timestamps: false,
    },
  );

  return RolePermission;
};
