import dotenv from 'dotenv';
import path from 'path';

// In production (Railway etc.) env vars are injected directly; locally use .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function optionalInt(key: string, fallback: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : fallback;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: optionalInt('PORT', 3001),
  appName: optional('APP_NAME', 'Celestix Workspace'),
  appUrl: optional('APP_URL', 'http://localhost:3000'),
  apiUrl: optional('API_URL', 'http://localhost:3001'),

  database: {
    url: required('DATABASE_URL'),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '30d'),
  },

  session: {
    secret: required('SESSION_SECRET'),
  },

  storage: {
    path: optional('STORAGE_PATH', './storage'),
    maxFileSize: optionalInt('MAX_FILE_SIZE', 524288000),
    maxAvatarSize: optionalInt('MAX_AVATAR_SIZE', 5242880),
    userQuota: optionalInt('USER_STORAGE_QUOTA', 5368709120),
  },

  smtp: {
    host: optional('SMTP_HOST', 'smtp.gmail.com'),
    port: optionalInt('SMTP_PORT', 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: optional('SMTP_FROM', 'noreply@celestix.local'),
  },

  webrtc: {
    stunUrl: optional('STUN_URL', 'stun:stun.l.google.com:19302'),
    turnUrl: process.env.TURN_URL || '',
    turnUsername: process.env.TURN_USERNAME || '',
    turnPassword: process.env.TURN_PASSWORD || '',
  },

  giphy: {
    apiKey: process.env.GIPHY_API_KEY || '',
  },

  rateLimit: {
    windowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 60000),
    max: optionalInt('RATE_LIMIT_MAX', 10000),
    authMax: optionalInt('AUTH_RATE_LIMIT_MAX', 500),
    uploadMax: optionalInt('UPLOAD_RATE_LIMIT_MAX', 50),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(','),
  },

  totp: {
    issuer: optional('TOTP_ISSUER', 'Celestix Workspace'),
  },
} as const;
