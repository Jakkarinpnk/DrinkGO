import dotenv from 'dotenv';
dotenv.config();

export const authConfig = {
    jwtSecret: process.env.JWT_SECRET || 'your_super_secret_access_token_key',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your_super_secret_refresh_token_key',
    jwtExpiration: '15m' as const,        // 🔥 เติม as const ตรงนี้
    jwtRefreshExpiration: '7d' as const, // 🔥 เติม as const ตรงนี้
    googleClientId: process.env.GOOGLE_CLIENT_ID || ''
};