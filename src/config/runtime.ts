import crypto from 'crypto';

function parseCsv(value: string | undefined): string[] {
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
export const ALLOWED_ORIGINS: string[] = [...new Set([...envAllowedOrigins, ...defaultOrigins])];

export function isAllowedOrigin(origin: string | undefined): boolean {
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

export const PORT: number = Number(process.env.PORT || 3000);
export const HOST: string = process.env.HOST || '0.0.0.0';
export const IS_PRODUCTION: boolean = process.env.NODE_ENV === 'production';
export const SESSION_SECRET: string = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
export const DATABASE_URL: string = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL || '';

