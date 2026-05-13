import sequelize from '../config/database.js';
import FuelRequestModel from './FuelRequest.js';
import VehicleSpecModel from './VehicleSpec.js';
import VehicleModel from './Vehicle.js';
import DeviceAssignmentModel from './DeviceAssignment.js';
import OperationSessionModel from './OperationSession.js';
import OperationSessionRefuelModel from './OperationSessionRefuel.js';
import UserNotificationModel from './UserNotification.js';

// Initialize models
const FuelRequest = FuelRequestModel(sequelize);
const VehicleSpec = VehicleSpecModel(sequelize);
const Vehicle = VehicleModel(sequelize);
const DeviceAssignment = DeviceAssignmentModel(sequelize);
const OperationSession = OperationSessionModel(sequelize);
const OperationSessionRefuel = OperationSessionRefuelModel(sequelize);
const UserNotification = UserNotificationModel(sequelize);

// Define associations
Vehicle.hasMany(DeviceAssignment, { foreignKey: 'vehicleId' });
DeviceAssignment.belongsTo(Vehicle, { foreignKey: 'vehicleId' });
// VehicleSpec belongs to device (via deviceId)
// FuelRequest belongs to device (via deviceId)
OperationSession.hasMany(OperationSessionRefuel, {
  foreignKey: 'sessionId',
  as: 'refuels',
  onDelete: 'CASCADE',
});
OperationSessionRefuel.belongsTo(OperationSession, {
  foreignKey: 'sessionId',
  as: 'session',
});

// Sync database (create tables if they don't exist)
export const syncDatabase = async (force = false) => {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      console.log('🔄 Starting database sync...');
    }
    
    // Test connection first
    await sequelize.authenticate();
    
    // Handle force mode
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
    
    // Try sync without alter first (safer, creates tables if they don't exist)
    try {
      await sequelize.sync({ alter: false });
      if (isDev) {
        console.log('✅ Database synchronized (no alterations needed)');
      }
      return true;
    } catch (syncError) {
      // If tables don't exist, use alter: true
      if (syncError.name === 'SequelizeDatabaseError' || 
          syncError.message?.includes('does not exist') ||
          syncError.original?.code === '42P01') {
        if (isDev) {
          console.log('ℹ️ Tables missing, creating them...');
        }
        await sequelize.sync({ alter: true });
    if (isDev) {
      console.log('✅ Database synchronized successfully');
    }
    return true;
      }
      
      // For ENUM errors, log warning but continue (tables exist and are functional)
      const isEnumError = syncError.message?.includes('ENUM') || 
                          syncError.message?.includes('enum') ||
                          syncError.sql?.includes('ALTER TYPE') ||
                          syncError.original?.code === '42601' ||
                          syncError.original?.message?.includes('ALTER TYPE');
      
      if (isEnumError) {
        console.warn('⚠️ ENUM modification skipped (this is normal if ENUM values haven\'t changed):', syncError.message);
        // Continue - tables exist and are functional
        return true;
      }
      
      // Re-throw other errors
      throw syncError;
    }
  } catch (error) {
    console.error('❌ Database sync failed:', error.message);
    
    // Handle specific ENUM errors gracefully
    const isEnumError = error.message?.includes('ENUM') || 
                        error.message?.includes('enum') || 
                        error.sql?.includes('ALTER TYPE') || 
                        error.original?.code === '42601' ||
                        error.original?.message?.includes('ALTER TYPE');
    
    if (isEnumError) {
      console.warn('⚠️ ENUM modification error (tables are functional, continuing):', error.message);
      // Return true - tables exist and work, just ENUM modification failed
      return true;
    }
    
    // Don't crash the app for sync errors
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Continuing without database sync...');
      return false;
    } else {
      // In development, provide more details
      console.error('Error details:', {
        name: error.name,
        parent: error.parent?.message,
        original: error.original?.message,
        sql: error.sql
      });
      // Return false instead of throwing to allow server to continue
      return false;
    }
  }
};

export {
  FuelRequest,
  VehicleSpec,
  Vehicle,
  DeviceAssignment,
  OperationSession,
  OperationSessionRefuel,
  UserNotification,
};
export default sequelize;



