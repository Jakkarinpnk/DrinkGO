import { OAuth2Client } from 'google-auth-library';
import { authConfig } from '../config/auth.config';

const client = new OAuth2Client(authConfig.googleClientId);

export class GoogleAuthService {
    static async verifyGoogleToken(idToken: string) {
        try {
            const ticket = await client.verifyIdToken({
                idToken: idToken,
                audience: authConfig.googleClientId,
            });

            const payload = ticket.getPayload();
            if (!payload) {
                throw new Error('Google token payload is empty');
            }

            // ดึงข้อมูลที่จำเป็นจาก Google Profile
            return {
                googleId: payload.sub, // ID เฉพาะของบัญชี Google
                email: payload.email,
                fullName: payload.name || 'Google User',
                profileImg: payload.picture || null
            };
        } catch (error) {
            throw new Error('Invalid Google Token');
        }
    }
}