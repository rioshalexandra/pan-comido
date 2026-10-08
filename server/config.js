import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

export const config = {
  port: Number(process.env.PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || '',
  uploadDir: process.env.UPLOAD_DIR || path.join(rootDir, 'uploads'),
  storeTimezone: process.env.STORE_TIMEZONE || 'America/Argentina/Buenos_Aires',
  storeName: process.env.STORE_NAME || 'Pan Comido',
  defaultAdminUser: process.env.DEFAULT_ADMIN_USER || 'admin',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
  seedDemo: String(process.env.SEED_DEMO || 'true').toLowerCase() !== 'false',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function assertRuntimeConfig() {
  if (!config.databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
}
