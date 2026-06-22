import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const VehicleImmobilizationIntent = sequelize.define(
    'VehicleImmobilizationIntent',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      vehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'vehicleId',
      },
      deviceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'deviceId',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
      },
      action: {
        type: DataTypes.ENUM('immobilize', 'mobilize'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          'pending',
          'monitoring',
          'executing',
          'completed',
          'failed',
          'expired',
          'cancelled',
        ),
        allowNull: false,
        defaultValue: 'pending',
      },
      createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'createdByUserId',
      },
      cancelledByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'cancelledByUserId',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expiresAt',
      },
      gateSnapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        field: 'gateSnapshot',
      },
      traccarCommandType: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: 'traccarCommandType',
      },
      traccarCommandPayload: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'traccarCommandPayload',
      },
      executionStartedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'executionStartedAt',
      },
      executionCompletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'executionCompletedAt',
      },
      executionError: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'executionError',
      },
      executionAttempt: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'executionAttempt',
      },
      traccarDeliveryAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'traccarDeliveryAt',
      },
      traccarHttpStatus: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'traccarHttpStatus',
      },
      deliveryPhase: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: 'deliveryPhase',
      },
      confidence: {
        type: DataTypes.ENUM('unknown', 'sent', 'acknowledged', 'relay_reported', 'unverified'),
        allowNull: false,
        defaultValue: 'unknown',
      },
    },
    {
      tableName: 'vehicle_immobilization_intents',
      timestamps: true,
      indexes: [
        { fields: ['vehicleId'] },
        { fields: ['status'] },
        { fields: ['expiresAt'] },
      ],
    },
  );

  return VehicleImmobilizationIntent;
};
