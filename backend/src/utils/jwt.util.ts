import crypto from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { authConfig } from '../config/auth.config';
import { Role } from '../types';

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: Role;
  sessionId: string;
  tokenType: 'access';
}

interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  role: Role;
  sessionId: string;
  tokenType: 'refresh';
}

interface PasswordResetTokenPayload extends JwtPayload {
  sub: string;
  tokenType: 'password-reset';
  passwordFingerprint: string;
}

interface TokenSubject {
  userId: number;
  role: Role;
  sessionId: string;
}

export const generateAccessToken = ({ userId, role, sessionId }: TokenSubject): string =>
  jwt.sign(
    { role, sessionId, tokenType: 'access' },
    authConfig.jwtSecret,
    { subject: String(userId), expiresIn: authConfig.jwtExpiration, jwtid: crypto.randomUUID() },
  );

export const generateRefreshToken = ({ userId, role, sessionId }: TokenSubject): string =>
  jwt.sign(
    { role, sessionId, tokenType: 'refresh' },
    authConfig.jwtRefreshSecret,
    {
      subject: String(userId),
      expiresIn: authConfig.jwtRefreshExpiration,
      jwtid: crypto.randomUUID(),
    },
  );

export const generatePasswordResetToken = (userId: number, passwordFingerprint: string): string =>
  jwt.sign(
    { tokenType: 'password-reset', passwordFingerprint },
    authConfig.jwtSecret,
    {
      subject: String(userId),
      expiresIn: authConfig.passwordResetTokenMinutes * 60,
      jwtid: crypto.randomUUID(),
    },
  );

const isRole = (value: unknown): value is Role =>
  value === 'member' || value === 'owner' || value === 'admin';

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const payload = jwt.verify(token, authConfig.jwtSecret);
  if (
    typeof payload === 'string' ||
    payload.tokenType !== 'access' ||
    !payload.sub ||
    !isRole(payload.role) ||
    typeof payload.sessionId !== 'string'
  ) {
    throw new Error('Invalid access token payload');
  }
  return payload as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const payload = jwt.verify(token, authConfig.jwtRefreshSecret);
  if (
    typeof payload === 'string' ||
    payload.tokenType !== 'refresh' ||
    !payload.sub ||
    !isRole(payload.role) ||
    typeof payload.sessionId !== 'string'
  ) {
    throw new Error('Invalid refresh token payload');
  }
  return payload as RefreshTokenPayload;
};

export const verifyPasswordResetToken = (token: string): PasswordResetTokenPayload => {
  const payload = jwt.verify(token, authConfig.jwtSecret);
  if (
    typeof payload === 'string' ||
    payload.tokenType !== 'password-reset' ||
    !payload.sub ||
    typeof payload.passwordFingerprint !== 'string'
  ) {
    throw new Error('Invalid password reset token payload');
  }
  return payload as PasswordResetTokenPayload;
};
