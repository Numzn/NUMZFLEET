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
    },
    {
      tableName: 'vehicles',
      timestamps: true,
      indexes: [{ fields: ['name'] }],
    },
  );

  return Vehicle;
};
