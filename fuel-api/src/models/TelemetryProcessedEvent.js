import { DataTypes } from 'sequelize';

/**
 * Sequelize mirror of migrations/20260712_telemetry_processed_events.sql.
 * telemetryIngestion.js reads/writes this table exclusively via raw
 * sequelize.query() (never through this model's own methods) because
 * event_id is a plain bigint idempotency key, not a typical Sequelize PK
 * workflow. This model exists solely so syncDatabase() creates the table —
 * CI's quality-checks job provisions its test database with syncDatabase()
 * and never replays raw SQL migrations (see docs/TENANCY_ARCHITECTURE.md
 * §11's note on companies.traccar_group_id for the same pattern already
 * established elsewhere). Without this model, every test exercising the
 * real webhook ingestion path fails in CI with "relation does not exist"
 * while passing locally against a dev database that has run the real
 * migration — column names/types must stay byte-for-byte identical to the
 * raw migration for that reason.
 */
export default (sequelize) => {
  const TelemetryProcessedEvent = sequelize.define('TelemetryProcessedEvent', {
    eventId: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      field: 'event_id',
    },
    deviceId: { type: DataTypes.INTEGER, allowNull: true },
    eventType: { type: DataTypes.STRING(32), allowNull: true },
    vehicleId: { type: DataTypes.UUID, allowNull: true },
    outcome: { type: DataTypes.STRING(24), allowNull: false },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'telemetry_processed_events',
    timestamps: false,
    indexes: [
      { fields: ['processedAt'] },
    ],
  });

  return TelemetryProcessedEvent;
};
