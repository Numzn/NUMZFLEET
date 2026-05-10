import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const VehicleSpec = sequelize.define('VehicleSpec', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      comment: 'Traccar device ID (unique)'
    },
    tankCapacity: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 60,
      comment: 'Tank capacity in liters'
    },
    fuelEfficiency: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 10,
      comment: 'Fuel efficiency in km/L'
    },
    fuelType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Petrol',
      comment: 'Fuel type (Petrol, Diesel, etc.)'
    },
    lastUpdated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When spec was last updated'
    },
    syncedFromTraccar: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether spec was synced from Traccar device attributes'
    },
    customOverride: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether spec was manually overridden by manager'
    }
  }, {
    tableName: 'vehicle_specs',
    timestamps: true,
    indexes: [
      { fields: ['deviceId'], unique: true }
    ]
  });

  return VehicleSpec;
};

