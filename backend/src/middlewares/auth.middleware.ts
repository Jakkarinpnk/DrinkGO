import { NextFunction, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { db } from '../config/db';
import { AppError } from '../errors/app-error';
import { AccountStatus, AuthRequest, Role } from '../types';
import { verifyAccessToken } from '../utils/jwt.util';

interface AuthAccountRow extends RowDataPacket {
  id: number;
  email: string;
  role: Role;
  account_status: AccountStatus;
  last_activity_at: Date | string | null;
}

export const authenticate = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'กรุณาเข้าสู่ระบบ');
    }
    const payload = verifyAccessToken(authHeader.slice(7));
    const accountId = Number(payload.sub);
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Token ไม่ถูกต้องหรือหมดอายุ');
    }

    const sql = payload.role === 'admin'
      ? `SELECT a.admin_id AS id, a.email, 'admin' AS role, 'ACTIVE' AS account_status,
           NULL AS last_activity_at
         FROM admins a WHERE a.admin_id = ? LIMIT 1`
      : `SELECT u.user_id AS id, u.email, u.role, u.account_status, u.last_activity_at
         FROM users u WHERE u.user_id = ? LIMIT 1`;
    const [rows] = await db.query<AuthAccountRow[]>(sql, [accountId]);
    const account = rows[0];
    if (!account) {
      throw new AppError(401, 'SESSION_REVOKED', 'เซสชันไม่ถูกต้องหรือถูกยกเลิกแล้ว');
    }
    if (account.account_status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'บัญชีถูกระงับการใช้งาน');
    }
    const lastActivityTime = account.last_activity_at
      ? new Date(account.last_activity_at).getTime()
      : 0;
    if (payload.role !== 'admin' &&
        (!Number.isFinite(lastActivityTime) || lastActivityTime <= Date.now() - 60_000)) {
      await db.query('UPDATE users SET last_activity_at = UTC_TIMESTAMP(3) WHERE user_id = ?', [accountId]);
    }
    req.user = { id: account.id, email: account.email, role: account.role, sessionId: payload.sessionId };
    next();
  } catch (error) {
    if (error instanceof AppError) { next(error); return; }
    next(new AppError(401, 'INVALID_ACCESS_TOKEN', 'Token ไม่ถูกต้องหรือหมดอายุ'));
  }
};

export const authorize = (...roles: Role[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) { next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'กรุณาเข้าสู่ระบบ')); return; }
    if (!roles.includes(req.user.role)) { next(new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้')); return; }
    next();
  };
