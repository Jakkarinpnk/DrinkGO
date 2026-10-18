import { NextFunction, Request, Response } from 'express';
import { AdminDashboardService } from '../services/admin-dashboard.service';

export const getAdminStoreStatisticsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const statistics = await AdminDashboardService.storeStatistics();
    res.status(200).json({ message: 'ดึงสถิติภาพรวมสำเร็จ', data: statistics });
  } catch (error) {
    next(error);
  }
};
