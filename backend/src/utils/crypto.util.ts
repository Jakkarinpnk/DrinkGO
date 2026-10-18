import crypto from 'crypto';

export const hashToken = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export const hashOtp = (otp: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(otp).digest('hex');

export const generateOtp = (): string => crypto.randomInt(100000, 1000000).toString();

export const generateSessionId = (): string => crypto.randomUUID();
