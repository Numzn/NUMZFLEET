import { DataTypes } from 'sequelize';

export const DAY_START_SOURCES = ['exact_boundary', 'nearest_before', 'nearest_after', 'unavailable'];

export default (sequelize) => {
  const VehicleDailyMileage = sequelize.define('VehicleDailyMileage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'vehicles', key: 'id' },
    },
    localDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'Africa/Lusaka',
    },
    dayStartOdometerKm: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    dayStartSource: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'unavailable',
      comment: 'exact_boundary / nearest_before / nearest_after / unavailable',
    },
    dayStartEvidenceFixtime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'fixtime of the historical position used to reconstruct the day-start baseline',
    },
    dayStartCapturedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    latestOdometerKm: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    latestOdometerConfidence: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'unavailable',
    },
    latestCapturedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    distanceKm: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: 'null means unavailable — never fabricated as 0',
    },
  }, {
    tableName: 'vehicle_daily_mileage',
    indexes: [
      { unique: true, fields: ['vehicleId', 'localDate'] },
    ],
  });

  return VehicleDailyMileage;
};
