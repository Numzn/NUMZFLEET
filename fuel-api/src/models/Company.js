import { DataTypes } from 'sequelize';

export const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

export default (sequelize) => {
  const Company = sequelize.define(
    'Company',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      slug: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
      },
      traccarGroupId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'traccar_group_id',
      },
      settings: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      organizationType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'customer',
        field: 'organization_type',
      },
      parentCompanyId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'parent_company_id',
        references: { model: 'companies', key: 'id' },
      },
    },
    {
      tableName: 'companies',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return Company;
};
