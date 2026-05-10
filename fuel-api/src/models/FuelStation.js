import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const FuelStation = sequelize.define('FuelStation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Station name'
    },
    location: {
      type: DataTypes.STRING,
      comment: 'Station location/address'
    },
    latitude: {
      type: DataTypes.DOUBLE,
      comment: 'Station latitude'
    },
    longitude: {
      type: DataTypes.DOUBLE,
      comment: 'Station longitude'
    },
    pricePerLiter: {
      type: DataTypes.DOUBLE,
      comment: 'Current price per liter'
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'K',
      comment: 'Currency code (K for Kwacha)'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether station is currently active'
    },
    contactName: {
      type: DataTypes.STRING,
      comment: 'Contact person name'
    },
    contactPhone: {
      type: DataTypes.STRING,
      comment: 'Contact phone number'
    },
    operatingHours: {
      type: DataTypes.STRING,
      comment: 'Operating hours (e.g., "24/7" or "6AM-10PM")'
    }
  }, {
    tableName: 'fuel_stations',
    timestamps: true,
    indexes: [
      { fields: ['isActive'] },
      { fields: ['latitude', 'longitude'] }
    ]
  });

  return FuelStation;
};
























