import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const VehicleFuelInterval = sequelize.define('VehicleFuelInterval', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fleetVehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'fleet_vehicle_id',
      references: { model: 'vehicles', key: 'id' },
    },
    refuelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'refuel_id',
      references: { model: 'operation_session_refuels', key: 'id' },
    },
    previousRefuelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'previous_refuel_id',
    },
    distanceKm: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'distance_km',
    },
    litresConsumed: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'litres_consumed',
    },
    efficiencyKmL: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      field: 'efficiency_km_l',
    },
    validationStatus: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'validation_status',
    },
    isAnomalous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_anomalous',
    },
    eventAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'event_at',
    },
  }, {
    tableName: 'vehicle_fuel_intervals',
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  });

  return VehicleFuelInterval;
};
