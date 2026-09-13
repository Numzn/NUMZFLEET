import { DataTypes } from 'sequelize';

/**
 * NUMZFLEET's own driver record — the business identity is `id` (a NUMZFLEET
 * UUID), never `traccarDriverId`, which is an integration reference only.
 * Traccar's own tc_drivers row is a synchronized projection maintained by
 * the driver Traccar integration layer, not read back through this model.
 */
export default (sequelize) => {
  const Driver = sequelize.define(
    'Driver',
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
      numzUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'numz_user_id',
        references: { model: 'numz_users', key: 'id' },
      },
      traccarDriverId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
        field: 'traccar_driver_id',
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      uniqueId: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
        field: 'unique_id',
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    {
      tableName: 'drivers',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['companyId'] },
        { fields: ['numzUserId'] },
      ],
    },
  );

  return Driver;
};
