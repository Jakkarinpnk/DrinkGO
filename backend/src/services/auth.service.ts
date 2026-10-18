import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../config/db';
import { authConfig } from '../config/auth.config';
import { AppError } from '../errors/app-error';
import { AccountStatus, Role } from '../types';
import { comparePassword, hashPassword } from '../utils/bcrypt.util';
import { generateOtp, generateSessionId, hashOtp } from '../utils/crypto.util';
import { sendPasswordResetOtp } from '../utils/email.util';
import {
  generateAccessToken,
  generatePasswordResetToken,
  generateRefreshToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
} from '../utils/jwt.util';
import { GoogleAuthService } from './google-auth.service';

interface AccountRow extends RowDataPacket {
  id: number; email: string; password_hash: string | null; google_id: string | null;
  full_name: string; phone: string | null; profile_image_url: string | null;
  role: Role; account_status: AccountStatus;
}

interface OtpRow extends RowDataPacket { id: number; otp_hash: string; expires_at: Date; attempt_count: number; }
interface ResetUserRow extends RowDataPacket { id: number; password_hash: string | null; account_status: AccountStatus; }
interface PublicUser { id: number; email: string; fullName: string; phone: string | null; profileImageUrl: string | null; role: Role; }
interface AuthenticationResult { accessToken: string; refreshToken: string; user: PublicUser; }

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const isAdminRole = (role: Role): boolean => role === 'admin';
const publicUser = (account: AccountRow): PublicUser => ({
  id: account.id, email: account.email, fullName: account.full_name, phone: account.phone,
  profileImageUrl: account.profile_image_url, role: account.role,
});
const userSelect = `SELECT user_id AS id, email, password_hash, google_id, full_name,
  phone_number AS phone, profile_image AS profile_image_url, role, account_status FROM users`;
const adminSelect = `SELECT admin_id AS id, email, password_hash, NULL AS google_id, full_name,
  phone_number AS phone, profile_image AS profile_image_url, 'admin' AS role,
  'ACTIVE' AS account_status FROM admins`;

export class AuthService {
  private static ensureAccountIsActive(account: { account_status: AccountStatus }): void {
    if (account.account_status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'บัญชีถูกระงับการใช้งาน');
    }
  }

  private static async findAccountById(id: number, role: Role): Promise<AccountRow | undefined> {
    const sql = isAdminRole(role)
      ? `${adminSelect} WHERE admin_id = ? LIMIT 1`
      : `${userSelect} WHERE user_id = ? LIMIT 1`;
    const [rows] = await db.query<AccountRow[]>(sql, [id]);
    return rows[0];
  }

  private static createSession(account: AccountRow, sessionId = generateSessionId()): AuthenticationResult {
    const tokenSubject = { userId: account.id, role: account.role, sessionId };
    const accessToken = generateAccessToken(tokenSubject);
    const refreshToken = generateRefreshToken(tokenSubject);
    return { accessToken, refreshToken, user: publicUser(account) };
  }

  private static async recordUserActivity(account: AccountRow): Promise<void> {
    if (isAdminRole(account.role)) return;
    await db.query('UPDATE users SET last_activity_at = UTC_TIMESTAMP(3) WHERE user_id = ?', [account.id]);
  }

  static async register(emailInput: string, password: string, fullName: string, phone: string | null): Promise<PublicUser> {
    const email = normalizeEmail(emailInput);
    const passwordHash = await hashPassword(password);
    try {
      const [result] = await db.query<ResultSetHeader>(`INSERT INTO users
        (email, password_hash, full_name, phone_number, role, account_status)
        VALUES (?, ?, ?, ?, 'member', 'ACTIVE')`, [email, passwordHash, fullName.trim(), phone]);
      const account = await this.findAccountById(result.insertId, 'member');
      if (!account) throw new Error('Created user could not be loaded');
      return publicUser(account);
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'อีเมลนี้ถูกใช้งานแล้ว');
      }
      throw error;
    }
  }

  static async login(emailInput: string, password: string): Promise<AuthenticationResult> {
    const email = normalizeEmail(emailInput);
    const [users] = await db.query<AccountRow[]>(`${userSelect} WHERE email = ? LIMIT 1`, [email]);
    let account = users[0];
    if (!account?.password_hash || !(await comparePassword(password, account.password_hash))) {
      const [admins] = await db.query<AccountRow[]>(`${adminSelect} WHERE email = ? LIMIT 1`, [email]);
      const admin = admins[0];
      if (!admin?.password_hash || !(await comparePassword(password, admin.password_hash))) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }
      account = admin;
    }
    this.ensureAccountIsActive(account);
    await this.recordUserActivity(account);
    return this.createSession(account);
  }

  static async googleLogin(idToken: string): Promise<AuthenticationResult> {
    const googleProfile = await GoogleAuthService.verifyGoogleToken(idToken);
    const connection = await db.getConnection();
    let account: AccountRow;
    try {
      await connection.beginTransaction();
      const [googleUsers] = await connection.query<AccountRow[]>(`${userSelect} WHERE google_id = ? LIMIT 1 FOR UPDATE`, [googleProfile.googleId]);
      if (googleUsers[0]) {
        account = googleUsers[0];
      } else {
        const [emailUsers] = await connection.query<AccountRow[]>(`${userSelect} WHERE email = ? LIMIT 1 FOR UPDATE`, [googleProfile.email]);
        if (emailUsers[0]) {
          account = emailUsers[0];
          await connection.query(`UPDATE users SET google_id = ?, profile_image = COALESCE(profile_image, ?) WHERE user_id = ?`,
            [googleProfile.googleId, googleProfile.profileImageUrl, account.id]);
          account.google_id = googleProfile.googleId;
          account.profile_image_url ||= googleProfile.profileImageUrl;
        } else {
          const [result] = await connection.query<ResultSetHeader>(`INSERT INTO users
            (email, password_hash, full_name, phone_number, profile_image, google_id, role, account_status)
            VALUES (?, NULL, ?, NULL, ?, ?, 'member', 'ACTIVE')`,
          [googleProfile.email, googleProfile.fullName, googleProfile.profileImageUrl, googleProfile.googleId]);
          const [createdUsers] = await connection.query<AccountRow[]>(`${userSelect} WHERE user_id = ?`, [result.insertId]);
          account = createdUsers[0];
        }
      }
      this.ensureAccountIsActive(account);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error instanceof AppError) throw error;
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new AppError(409, 'GOOGLE_ACCOUNT_CONFLICT', 'บัญชี Google นี้ถูกเชื่อมแล้ว');
      }
      throw error;
    } finally { connection.release(); }
    await this.recordUserActivity(account);
    return this.createSession(account);
  }

  static async refresh(refreshToken: string): Promise<AuthenticationResult> {
    let payload;
    try { payload = verifyRefreshToken(refreshToken); }
    catch { throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token ไม่ถูกต้องหรือหมดอายุ'); }
    const accountId = Number(payload.sub);
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token ไม่ถูกต้องหรือหมดอายุ');
    }
    const account = await this.findAccountById(accountId, payload.role);
    if (!account) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token ไม่ถูกต้องหรือถูกยกเลิกแล้ว');
    }
    this.ensureAccountIsActive(account);
    await this.recordUserActivity(account);
    return this.createSession(account, payload.sessionId);
  }

  static async logout(refreshToken: string): Promise<void> {
    try { verifyRefreshToken(refreshToken); } catch { return; }
  }

  static async requestPasswordReset(emailInput: string): Promise<void> {
    const email = normalizeEmail(emailInput);
    const [users] = await db.query<AccountRow[]>(`${userSelect} WHERE email = ? AND password_hash IS NOT NULL LIMIT 1`, [email]);
    const user = users[0];
    if (!user || user.account_status !== 'ACTIVE') return;
    const [recent] = await db.query<(RowDataPacket & { request_count: number })[]>(`SELECT COUNT(*) AS request_count
      FROM password_resets WHERE user_id = ? AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 1 HOUR`, [user.id]);
    if (recent[0].request_count >= 5) throw new AppError(429, 'TOO_MANY_OTP_REQUESTS', 'ขอรหัส OTP บ่อยเกินไป กรุณาลองใหม่ภายหลัง');
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + authConfig.passwordResetOtpMinutes * 60 * 1000);
    const [result] = await db.query<ResultSetHeader>(`INSERT INTO password_resets
      (user_id, otp_hash, expires_at) VALUES (?, ?, ?)`,
    [user.id, hashOtp(otp, authConfig.jwtSecret), expiresAt]);
    try { await sendPasswordResetOtp(user.email, otp, authConfig.passwordResetOtpMinutes); }
    catch (error) {
      console.error('Password reset OTP email failed:', error instanceof Error ? error.message : error);
      await db.query(`UPDATE password_resets
        SET expires_at = UTC_TIMESTAMP(3), attempt_count = 5 WHERE id = ?`, [result.insertId]);
      throw new AppError(503, 'EMAIL_SEND_FAILED', 'ไม่สามารถส่งอีเมล OTP ได้ในขณะนี้');
    }
  }

  static async verifyPasswordResetOtp(emailInput: string, otp: string): Promise<string> {
    const [users] = await db.query<AccountRow[]>(`${userSelect} WHERE email = ? LIMIT 1`, [normalizeEmail(emailInput)]);
    const user = users[0];
    if (!user) throw new AppError(400, 'INVALID_OR_EXPIRED_OTP', 'OTP ไม่ถูกต้องหรือหมดอายุ');
    const [rows] = await db.query<OtpRow[]>(`SELECT id, otp_hash, expires_at, attempt_count FROM password_resets
      WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`, [user.id]);
    const record = rows[0];
    if (!record || record.expires_at.getTime() <= Date.now() || record.attempt_count >= 5 ||
        record.otp_hash !== hashOtp(otp, authConfig.jwtSecret)) {
      if (record) await db.query(`UPDATE password_resets
        SET attempt_count = LEAST(attempt_count + 1, 5) WHERE id = ?`, [record.id]);
      throw new AppError(400, 'INVALID_OR_EXPIRED_OTP', 'OTP ไม่ถูกต้องหรือหมดอายุ');
    }
    if (!user.password_hash) throw new AppError(400, 'INVALID_OR_EXPIRED_OTP', 'OTP ไม่ถูกต้องหรือหมดอายุ');
    const resetToken = generatePasswordResetToken(
      user.id,
      hashOtp(user.password_hash, authConfig.jwtSecret),
    );
    await db.query(`UPDATE password_resets
      SET expires_at = UTC_TIMESTAMP(3), attempt_count = 5 WHERE id = ?`, [record.id]);
    return resetToken;
  }

  static async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    let payload;
    try { payload = verifyPasswordResetToken(resetToken); }
    catch { throw new AppError(400, 'INVALID_OR_EXPIRED_RESET_TOKEN', 'สิทธิ์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือหมดอายุ'); }
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new AppError(400, 'INVALID_OR_EXPIRED_RESET_TOKEN', 'สิทธิ์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือหมดอายุ');
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<ResetUserRow[]>(`SELECT user_id AS id, password_hash, account_status
        FROM users WHERE user_id = ? LIMIT 1 FOR UPDATE`, [userId]);
      const user = rows[0];
      if (!user?.password_hash || user.account_status !== 'ACTIVE' ||
          hashOtp(user.password_hash, authConfig.jwtSecret) !== payload.passwordFingerprint) {
        throw new AppError(400, 'INVALID_OR_EXPIRED_RESET_TOKEN', 'สิทธิ์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือหมดอายุ');
      }
      if (await comparePassword(newPassword, user.password_hash)) {
        throw new AppError(400, 'PASSWORD_REUSED', 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
      }
      const passwordHash = await hashPassword(newPassword);
      await connection.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, userId]);
      await connection.query(`UPDATE password_resets
        SET expires_at = UTC_TIMESTAMP(3), attempt_count = 5 WHERE user_id = ?`, [userId]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  static async changePassword(accountId: number, role: Role, currentPassword: string, newPassword: string): Promise<void> {
    const account = await this.findAccountById(accountId, role);
    if (!account?.password_hash || !(await comparePassword(currentPassword, account.password_hash))) {
      throw new AppError(400, 'CURRENT_PASSWORD_INCORRECT', 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    if (await comparePassword(newPassword, account.password_hash)) {
      throw new AppError(400, 'PASSWORD_REUSED', 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
    }
    const hash = await hashPassword(newPassword);
    const admin = isAdminRole(role);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      if (admin) {
        await connection.query('UPDATE admins SET password_hash = ? WHERE admin_id = ?', [hash, accountId]);
      } else {
        await connection.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hash, accountId]);
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  static async getCurrentUser(accountId: number, role: Role): Promise<PublicUser> {
    const account = await this.findAccountById(accountId, role);
    if (!account) throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบบัญชีผู้ใช้');
    return publicUser(account);
  }

  static async updateProfile(accountId: number, role: Role, emailInput: string, fullName: string,
    phone: string | null, profileImageUrl?: string): Promise<PublicUser> {
    const email = normalizeEmail(emailInput);
    const admin = isAdminRole(role);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = admin
        ? await connection.query<ResultSetHeader>(`UPDATE admins SET email = ?, full_name = ?, phone_number = ?,
            profile_image = COALESCE(?, profile_image) WHERE admin_id = ?`, [email, fullName.trim(), phone, profileImageUrl || null, accountId])
        : await connection.query<ResultSetHeader>(`UPDATE users SET email = ?, full_name = ?, phone_number = ?,
            profile_image = COALESCE(?, profile_image) WHERE user_id = ?`, [email, fullName.trim(), phone, profileImageUrl || null, accountId]);
      if (!result.affectedRows) throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบบัญชีผู้ใช้');
      await connection.commit();
      const account = await this.findAccountById(accountId, role);
      if (!account) throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบบัญชีผู้ใช้');
      return publicUser(account);
    } catch (error) {
      await connection.rollback();
      if (error instanceof AppError) throw error;
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'อีเมลนี้ถูกใช้งานแล้ว');
      }
      throw error;
    } finally { connection.release(); }
  }
}
