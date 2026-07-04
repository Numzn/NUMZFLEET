import { DataTypes } from 'sequelize';

export const ACTIVITY_STATE_SOURCES = ['observed', 'reconstructed', 'unavailable'];

export default (sequelize) => {
  const VehicleActivityState = sequelize.define('VehicleActivityState', {
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
    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(16),
      allowNull: false,
      comment: 'moving / idle / offline',
    },
    stateEnteredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    stateSource: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'observed',
      comment: 'observed (transition detected live) / reconstructed (from tc_events history) / unavailable',
    },
    lastEvaluatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'vehicle_activity_state',
    indexes: [
      { unique: true, fields: ['vehicleId'] },
    ],
  });

  return VehicleActivityState;
};
