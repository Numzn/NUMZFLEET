import sequelize from '../config/database.js';
import FuelRequestModel from './FuelRequest.js';
import VehicleSpecModel from './VehicleSpec.js';
import VehicleModel from './Vehicle.js';
import DeviceAssignmentModel from './DeviceAssignment.js';
import OperationSessionModel from './OperationSession.js';
import OperationSessionRefuelModel from './OperationSessionRefuel.js';
import OperationAuditEventModel from './OperationAuditEvent.js';
import OperationAdjustmentModel from './OperationAdjustment.js';
import OperationUnlockModel from './OperationUnlock.js';
import OperationSessionInvoiceModel from './OperationSessionInvoice.js';
import UserNotificationModel from './UserNotification.js';
import VehicleImmobilizationIntentModel from './VehicleImmobilizationIntent.js';
import CompanyModel, { DEFAULT_COMPANY_ID } from './Company.js';
import NumzUserModel from './NumzUser.js';
import CompanyDeviceModel from './CompanyDevice.js';
import ServiceRecordModel from './ServiceRecord.js';
import MaintenanceBudgetModel from './MaintenanceBudget.js';
import VehicleDocumentModel from './VehicleDocument.js';
import VehicleComplianceModel from './VehicleCompliance.js';
import VehicleFuelLearningModel from './VehicleFuelLearning.js';
import VehicleFuelIntervalModel from './VehicleFuelInterval.js';

const FuelRequest = FuelRequestModel(sequelize);
const VehicleSpec = VehicleSpecModel(sequelize);
const Vehicle = VehicleModel(sequelize);
const DeviceAssignment = DeviceAssignmentModel(sequelize);
const OperationSession = OperationSessionModel(sequelize);
const OperationSessionRefuel = OperationSessionRefuelModel(sequelize);
const OperationAuditEvent = OperationAuditEventModel(sequelize);
const OperationAdjustment = OperationAdjustmentModel(sequelize);
const OperationUnlock = OperationUnlockModel(sequelize);
const OperationSessionInvoice = OperationSessionInvoiceModel(sequelize);
const UserNotification = UserNotificationModel(sequelize);
const VehicleImmobilizationIntent = VehicleImmobilizationIntentModel(sequelize);
const Company = CompanyModel(sequelize);
const NumzUser = NumzUserModel(sequelize);
const CompanyDevice = CompanyDeviceModel(sequelize);
const ServiceRecord = ServiceRecordModel(sequelize);
const MaintenanceBudget = MaintenanceBudgetModel(sequelize);
const VehicleDocument = VehicleDocumentModel(sequelize);
const VehicleCompliance = VehicleComplianceModel(sequelize);
const VehicleFuelLearning = VehicleFuelLearningModel(sequelize);
const VehicleFuelInterval = VehicleFuelIntervalModel(sequelize);

Company.hasMany(Vehicle, { foreignKey: 'companyId' });
Vehicle.belongsTo(Company, { foreignKey: 'companyId' });
Company.hasMany(NumzUser, { foreignKey: 'companyId' });
NumzUser.belongsTo(Company, { foreignKey: 'companyId' });
Company.hasMany(CompanyDevice, { foreignKey: 'companyId' });
CompanyDevice.belongsTo(Company, { foreignKey: 'companyId' });
Company.hasMany(ServiceRecord, { foreignKey: 'companyId', as: 'serviceRecords' });
ServiceRecord.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Company.hasOne(MaintenanceBudget, { foreignKey: 'companyId', as: 'maintenanceBudget' });
MaintenanceBudget.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Vehicle.hasMany(DeviceAssignment, { foreignKey: 'vehicleId' });
DeviceAssignment.belongsTo(Vehicle, { foreignKey: 'vehicleId' });
Vehicle.hasMany(VehicleImmobilizationIntent, { foreignKey: 'vehicleId', as: 'immobilizationIntents' });
VehicleImmobilizationIntent.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
Vehicle.hasMany(ServiceRecord, { foreignKey: 'fleetVehicleId', as: 'serviceRecords' });
ServiceRecord.belongsTo(Vehicle, { foreignKey: 'fleetVehicleId', as: 'vehicle' });
Vehicle.hasMany(VehicleDocument, { foreignKey: 'fleetVehicleId', as: 'documents' });
VehicleDocument.belongsTo(Vehicle, { foreignKey: 'fleetVehicleId', as: 'vehicle' });
Vehicle.hasMany(VehicleCompliance, { foreignKey: 'fleetVehicleId', as: 'complianceItems' });
VehicleCompliance.belongsTo(Vehicle, { foreignKey: 'fleetVehicleId', as: 'vehicle' });
VehicleDocument.hasMany(VehicleCompliance, { foreignKey: 'documentId', as: 'complianceItems' });
VehicleCompliance.belongsTo(VehicleDocument, { foreignKey: 'documentId', as: 'document' });
Vehicle.hasOne(VehicleFuelLearning, { foreignKey: 'fleetVehicleId', as: 'fuelLearning' });
VehicleFuelLearning.belongsTo(Vehicle, { foreignKey: 'fleetVehicleId', as: 'vehicle' });
Vehicle.hasMany(VehicleFuelInterval, { foreignKey: 'fleetVehicleId', as: 'fuelIntervals' });
VehicleFuelInterval.belongsTo(Vehicle, { foreignKey: 'fleetVehicleId', as: 'vehicle' });
OperationSession.hasMany(OperationSessionRefuel, {
  foreignKey: 'sessionId',
  as: 'refuels',
  onDelete: 'CASCADE',
});
OperationSessionRefuel.belongsTo(OperationSession, {
  foreignKey: 'sessionId',
  as: 'session',
});
OperationSession.hasMany(OperationAuditEvent, {
  foreignKey: 'operationId',
  as: 'auditEvents',
  onDelete: 'CASCADE',
});
OperationAuditEvent.belongsTo(OperationSession, { foreignKey: 'operationId', as: 'operation' });
OperationSession.hasMany(OperationAdjustment, {
  foreignKey: 'operationId',
  as: 'adjustments',
  onDelete: 'CASCADE',
});
OperationAdjustment.belongsTo(OperationSession, { foreignKey: 'operationId', as: 'operation' });
OperationSession.hasMany(OperationUnlock, {
  foreignKey: 'operationId',
  as: 'unlocks',
  onDelete: 'CASCADE',
});
OperationUnlock.belongsTo(OperationSession, { foreignKey: 'operationId', as: 'operation' });
OperationSession.hasMany(OperationSessionInvoice, {
  foreignKey: 'operationId',
  as: 'invoices',
  onDelete: 'CASCADE',
});
OperationSessionInvoice.belongsTo(OperationSession, { foreignKey: 'operationId', as: 'operation' });

export const syncDatabase = async (force = false) => {
  try {
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      console.log('🔄 Starting database sync...');
    }

    await sequelize.authenticate();

    if (force) {
      if (isDev) {
        console.log('⚠️ Force mode: Dropping and recreating all tables');
      }
      await sequelize.sync({ force: true });
      if (isDev) {
        console.log('✅ Database synchronized successfully (force mode)');
      }
      return true;
    }

    try {
      await sequelize.sync({ alter: false });
      if (isDev) {
        console.log('✅ Database synchronized (no alterations needed)');
      }
      return true;
    } catch (syncError) {
      if (syncError.name === 'SequelizeDatabaseError'
          || syncError.message?.includes('does not exist')
          || syncError.original?.code === '42P01') {
        if (isDev) {
          console.log('ℹ️ Tables missing, creating them...');
        }
        await sequelize.sync({ alter: true });
        if (isDev) {
          console.log('✅ Database synchronized successfully');
        }
        return true;
      }

      const isEnumError = syncError.message?.includes('ENUM')
        || syncError.message?.includes('enum')
        || syncError.sql?.includes('ALTER TYPE')
        || syncError.original?.code === '42601'
        || syncError.original?.message?.includes('ALTER TYPE');

      if (isEnumError) {
        console.warn('⚠️ ENUM modification skipped (this is normal if ENUM values haven\'t changed):', syncError.message);
        return true;
      }

      throw syncError;
    }
  } catch (error) {
    console.error('❌ Database sync failed:', error.message);

    const isEnumError = error.message?.includes('ENUM')
      || error.message?.includes('enum')
      || error.sql?.includes('ALTER TYPE')
      || error.original?.code === '42601'
      || error.original?.message?.includes('ALTER TYPE');

    if (isEnumError) {
      console.warn('⚠️ ENUM modification error (tables are functional, continuing):', error.message);
      return true;
    }

    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Continuing without database sync...');
      return false;
    }

    console.error('Error details:', {
      name: error.name,
      parent: error.parent?.message,
      original: error.original?.message,
      sql: error.sql,
    });
    return false;
  }
};

export {
  FuelRequest,
  VehicleSpec,
  Vehicle,
  DeviceAssignment,
  OperationSession,
  OperationSessionRefuel,
  OperationAuditEvent,
  OperationAdjustment,
  OperationUnlock,
  OperationSessionInvoice,
  UserNotification,
  VehicleImmobilizationIntent,
  Company,
  NumzUser,
  CompanyDevice,
  ServiceRecord,
  MaintenanceBudget,
  VehicleDocument,
  VehicleCompliance,
  VehicleFuelLearning,
  VehicleFuelInterval,
  DEFAULT_COMPANY_ID,
};
export default sequelize;
