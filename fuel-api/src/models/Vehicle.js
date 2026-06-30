import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Vehicle = sequelize.define(
    'Vehicle',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      plateNumber: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      make: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      model: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      photoFileId: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: 'photo_file_id',
      },
      homeBaseLabel: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'home_base_label',
      },
    },
    {
      tableName: 'vehicles',
      timestamps: true,
      indexes: [{ fields: ['name'] }],
    },
  );

  return Vehicle;
};
