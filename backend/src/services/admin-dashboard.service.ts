import { RowDataPacket } from 'mysql2/promise';
import { db } from '../config/db';

export interface AdminStoreStatistics {
  onlineUsers: number;
  totalUsers: number;
  totalStores: number;
  pendingStores: number;
  approvedStores: number;
}

interface StoreStatisticsRow extends RowDataPacket {
  online_users: number | string;
  total_users: number | string;
  total_stores: number | string;
  pending_stores: number | string;
  approved_stores: number | string;
}

export class AdminDashboardService {
  static async storeStatistics(): Promise<AdminStoreStatistics> {
    const [rows] = await db.query<StoreStatisticsRow[]>(
      `SELECT
         (SELECT COUNT(*) FROM users
          WHERE account_status = 'ACTIVE'
            AND last_activity_at >= UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE) AS online_users,
         (SELECT COUNT(*) FROM users) AS total_users,
         COUNT(*) AS total_stores,
         COALESCE(SUM(approval_status = 'PENDING'), 0) AS pending_stores,
         COALESCE(SUM(approval_status = 'APPROVED'), 0) AS approved_stores
       FROM stores`,
    );
    const statistics = rows[0];
    return {
      onlineUsers: Number(statistics?.online_users || 0),
      totalUsers: Number(statistics?.total_users || 0),
      totalStores: Number(statistics?.total_stores || 0),
      pendingStores: Number(statistics?.pending_stores || 0),
      approvedStores: Number(statistics?.approved_stores || 0),
    };
  }
}
