import { OAuth2Client } from 'google-auth-library';
import { authConfig } from '../config/auth.config';
import { AppError } from '../errors/app-error';

const client = new OAuth2Client(authConfig.googleClientId);

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  fullName: string;
  profileImageUrl: string | null;
}

export class GoogleAuthService {
  static async verifyGoogleToken(idToken: string): Promise<GoogleUserProfile> {
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: authConfig.googleClientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new AppError(
          401,
          'GOOGLE_EMAIL_NOT_VERIFIED',
          'บัญชี Google ต้องมีอีเมลที่ยืนยันแล้ว',
        );
      }

      return {
        googleId: payload.sub,
        email: payload.email.trim().toLowerCase(),
        fullName: payload.name?.trim() || 'Google User',
        profileImageUrl: payload.picture || null,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Google Token ไม่ถูกต้อง');
    }
  }
}
