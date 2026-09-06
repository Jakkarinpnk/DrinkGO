import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth.config';

interface TokenPayload {
    userId: number;
    role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, authConfig.jwtSecret, { expiresIn: authConfig.jwtExpiration });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, authConfig.jwtRefreshSecret, { expiresIn: authConfig.jwtRefreshExpiration });
};