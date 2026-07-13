// Shared Sequelize attribute projection for narrow "vehicle identity" reads
// (id, name, plateNumber only) — used by call sites that need to label a
// vehicle without pulling in spec/telemetry/config data.
export const VEHICLE_IDENTITY_ATTRIBUTES = ['id', 'name', 'plateNumber'];
