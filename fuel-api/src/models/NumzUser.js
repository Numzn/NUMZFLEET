import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const NumzUser = sequelize.define(
    'NumzUser',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'password_hash',
      },
      displayName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: '',
        field: 'display_name',
      },
      traccarUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
        field: 'traccar_user_id',
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    {
      tableName: 'numz_users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return NumzUser;
};
