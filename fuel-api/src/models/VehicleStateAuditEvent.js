import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const VehicleStateAuditEvent = sequelize.define('VehicleStateAuditEvent', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'vehicles', key: 'id' },
    },
    previousState: {
      type: DataTypes.STRING(16),
      allowNull: true,
      comment: 'null for a first observation during a sweep — nothing existed to correct',
    },
    correctedState: { type: DataTypes.STRING(16), allowNull: false },
    previousStateEnteredAt: { type: DataTypes.DATE, allowNull: true },
    correctedStateEnteredAt: { type: DataTypes.DATE, allowNull: false },
    reason: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'e.g. excessive_reconstructed_duration, state_contradicted_by_recent_telemetry, transition_detected_during_sweep',
    },
    source: {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: 'reconciliation / startup / on_demand / webhook',
    },
    payload: { type: DataTypes.JSONB, allowNull: true },
  }, {
    tableName: 'vehicle_state_audit_events',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['vehicleId'] },
    ],
  });

  return VehicleStateAuditEvent;
};
