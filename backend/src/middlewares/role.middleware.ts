import { Request, Response, NextFunction } from 'express';

// ประกาศขยายสิทธิ์ให้กับ Express Request เพื่อให้ TypeScript ไม่ฟ้อง Error เวลาเรายัดค่า user เข้าไป
export interface CustomRequest extends Request {
    user?: {
        userId: number;
        role: 'user' | 'member' | 'owner' | 'admin';
    };
}

export const roleMiddleware = (allowedRoles: ('user' | 'member' | 'owner' | 'admin')[]) => {
    return (req: CustomRequest, res: Response, next: NextFunction): void => {
        // 1. ตรวจสอบว่ามีข้อมูล user จาก authMiddleware ไหม
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized - No user data found' });
            return;
        }

        // 2. เช็คสิทธิ์ (Role) ว่าตรงกับกลุ่มที่อนุญาตให้เข้าหน้านี้ไหม
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ message: 'Forbidden - You do not have permission to access this resource' });
            return;
        }

        next(); // ผ่านฉลุย ไปทำงานต่อที่ Controller ได้
    };
};