const path = require('path');
const crypto = require('crypto');

function parseCsv(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const envAllowedOrigins = parseCsv(process.env.CORS_ORIGINS);
const defaultOrigins = [
  'https://wafi-crm-server-client.vercel.app',
  'https://*.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];
const ALLOWED_ORIGINS = [...new Set([...envAllowedOrigins, ...defaultOrigins])];

function isAllowedOrigin(origin) {
  if (!origin) return true;

  return ALLOWED_ORIGINS.some((allowedOrigin) => {
    if (allowedOrigin === origin) return true;
    if (!allowedOrigin.includes('*')) return false;

    const escapedPattern = allowedOrigin
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    const regex = new RegExp(`^${escapedPattern}$`);
    return regex.test(origin);
  });
}

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL || '';
const LEGACY_SQLITE_PATH = process.env.LEGACY_SQLITE_PATH || path.join(__dirname, '..', '..', 'data', 'wafi-crm.db');
const IMPORT_LEGACY_SQLITE = process.env.IMPORT_LEGACY_SQLITE !== 'false';

module.exports = {
  ALLOWED_ORIGINS,
  DATABASE_URL,
  HOST,
  IMPORT_LEGACY_SQLITE,
  IS_PRODUCTION,
  LEGACY_SQLITE_PATH,
  PORT,
  SESSION_SECRET,
  isAllowedOrigin
};
