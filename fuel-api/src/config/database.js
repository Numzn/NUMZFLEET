import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

function buildDatabaseUrl() {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) return explicit;
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) {
    return '';
  }
  const user = process.env.POSTGRES_USER || 'numztrak';
  const host = process.env.POSTGRES_HOST || 'db';
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB || 'numztrak_fuel';
  const enc = encodeURIComponent(password);
  return `postgresql://${user}:${enc}@${host}:${port}/${database}`;
}

const databaseUrl = buildDatabaseUrl();
if (!databaseUrl) {
  throw new Error(
    'Missing PostgreSQL config: set DATABASE_URL or POSTGRES_PASSWORD (with optional POSTGRES_USER, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB)'
  );
}

// PostgreSQL connection for fuel management data
const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  retry: {
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    max: 3
  }
});

// Test connection
export const testConnection = async () => {
  try {
    await sequelize.authenticate();
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [PostgreSQL] Connection established successfully');
    }
    return true;
  } catch (error) {
    console.error('❌ [PostgreSQL] Unable to connect to the database:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', {
        name: error.name,
        parent: error.parent?.message,
        original: error.original?.message
      });
    }
    return false;
  }
};

export default sequelize;











