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
    verifiedOdometerKm: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: 'Last trusted odometer reading (km)'
    },
    verifiedOdometerAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the verified odometer was captured'
    },
    verifiedOdometerSource: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'onboarding / service / audit / manual'
    },
    verifiedTraccarDistance: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: 'Traccar totalDistance snapshot at verification (for delta math)'
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

