import { NextFunction, Request, Response } from 'express';
import { AuthRequest } from '../types';
import { AuthService } from '../services/auth.service';
import fs from 'fs/promises';
import path from 'path';
import { profileImageDirectory } from '../middlewares/profile-image.middleware';

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password, fullName, phone } = req.body;
    const user = await AuthService.register(email, password, fullName, phone || null);
    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ', data: user });
  } catch (error) {
    next(error);
  }
};

export const loginController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const data = await AuthService.login(email, password);
    res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ', data });
  } catch (error) {
    next(error);
  }
};

export const googleLoginController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await AuthService.googleLogin(req.body.idToken);
    res.status(200).json({ message: 'เข้าสู่ระบบด้วย Google สำเร็จ', data });
  } catch (error) {
    next(error);
  }
};

export const refreshController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await AuthService.refresh(req.body.refreshToken);
    res.status(200).json({ message: 'ต่ออายุเซสชันสำเร็จ', data });
  } catch (error) {
    next(error);
  }
};

export const activityController = (_req: AuthRequest, res: Response): void => {
  res.status(200).json({ message: 'บันทึกกิจกรรมผู้ใช้สำเร็จ' });
};

export const logoutController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await AuthService.logout(req.body.refreshToken);
    res.status(200).json({ message: 'ออกจากระบบสำเร็จ' });
  } catch (error) {
    next(error);
  }
};

export const forgotPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await AuthService.requestPasswordReset(req.body.email);
    res.status(200).json({
      message: 'หากอีเมลนี้มีอยู่ในระบบ ระบบจะส่งรหัส OTP ให้ทางอีเมล',
    });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { resetToken, newPassword } = req.body;
    await AuthService.resetPassword(resetToken, newPassword);
    res.status(200).json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง' });
  } catch (error) {
    next(error);
  }
};

export const verifyResetOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const resetToken = await AuthService.verifyPasswordResetOtp(req.body.email, req.body.otp);
    res.status(200).json({ message: 'ยืนยัน OTP สำเร็จ', data: { resetToken } });
  } catch (error) {
    next(error);
  }
};

export const changePasswordController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(req.user!.id, req.user!.role, currentPassword, newPassword);
    res.status(200).json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง' });
  } catch (error) {
    next(error);
  }
};

export const getProfileController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await AuthService.getCurrentUser(req.user!.id, req.user!.role);
    res.status(200).json({ message: 'ดึงข้อมูลผู้ใช้สำเร็จ', data: user });
  } catch (error) {
    next(error);
  }
};

export const updateProfileController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const previousUser = await AuthService.getCurrentUser(req.user!.id, req.user!.role);
    const { email, fullName, phone } = req.body;
    const profileImageUrl = req.file
      ? `/uploads/profile-images/${req.file.filename}`
      : undefined;
    const user = await AuthService.updateProfile(
      req.user!.id,
      req.user!.role,
      email,
      fullName,
      phone || null,
      profileImageUrl,
    );

    if (req.file && req.user!.role === 'admin') {
      await fs.unlink(req.file.path).catch(() => undefined);
    } else if (req.file && previousUser.profileImageUrl?.startsWith('/uploads/profile-images/')) {
      const previousImagePath = path.resolve(
        profileImageDirectory,
        path.basename(previousUser.profileImageUrl),
      );
      if (previousImagePath.startsWith(`${profileImageDirectory}${path.sep}`)) {
        await fs.unlink(previousImagePath).catch(() => undefined);
      }
    }

    res.status(200).json({ message: 'แก้ไขโปรไฟล์สำเร็จ', data: user });
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => undefined);
    }
    next(error);
  }
};
