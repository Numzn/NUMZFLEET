import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const CompanyDevice = sequelize.define(
    'CompanyDevice',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
      },
      traccarDeviceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'traccar_device_id',
      },
      vehicleId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'vehicle_id',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'company_devices',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );

  return CompanyDevice;
};
