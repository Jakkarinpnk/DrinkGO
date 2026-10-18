import { SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const parsePositiveInteger = (name: string, fallback: number): number => {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const clientUrls = requireEnv('CLIENT_URL')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  for (const url of [...clientUrls]) {
    if (url.includes('localhost')) clientUrls.push(url.replace('localhost', '127.0.0.1'));
    if (url.includes('127.0.0.1')) clientUrls.push(url.replace('127.0.0.1', 'localhost'));
  }
}

export const authConfig = {
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  jwtExpiration: (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'],
  jwtRefreshExpiration: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  passwordResetOtpMinutes: parsePositiveInteger('PASSWORD_RESET_OTP_MINUTES', 10),
  passwordResetTokenMinutes: parsePositiveInteger('PASSWORD_RESET_TOKEN_MINUTES', 10),
  googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
  clientUrls: [...new Set(clientUrls)],
};
