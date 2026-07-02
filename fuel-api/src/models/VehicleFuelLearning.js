import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const VehicleFuelLearning = sequelize.define('VehicleFuelLearning', {
    fleetVehicleId: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: 'fleet_vehicle_id',
      references: { model: 'vehicles', key: 'id' },
    },
    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'device_id',
    },
    currentEfficiency: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      field: 'current_efficiency',
    },
    specEfficiency: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      field: 'spec_efficiency',
    },
    confidence: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 0,
    },
    trend: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'stable',
    },
    totalObservations: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_observations',
    },
    totalDistanceKm: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'total_distance_km',
    },
    efficiencyHistory: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'efficiency_history',
    },
    lastIntervalAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_interval_at',
    },
  }, {
    tableName: 'vehicle_fuel_learning',
    timestamps: true,
    updatedAt: 'updated_at',
    createdAt: false,
  });

  return VehicleFuelLearning;
};
