import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { db } from '../config/db';
import { AppError } from '../errors/app-error';

export interface StoreCategory { id: number; name: string; }
export interface StoreHour { dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null; closesNextDay: boolean; }
export interface StoreOperations { category: StoreCategory | null; hours: StoreHour[]; }
export interface StoreOperationsInput { categoryId: number; hours: StoreHour[]; }

export const isStoreHours = (value: unknown): boolean => {
  if (!Array.isArray(value) || value.length !== 7) return false;
  const seen = new Set<number>();
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  let openDayCount = 0;
  let sharedOpenTime: string | null = null;
  let sharedCloseTime: string | null = null;
  for (const hour of value) {
    if (!hour || !Number.isInteger(hour.dayOfWeek) || hour.dayOfWeek < 0 || hour.dayOfWeek > 6 ||
        seen.has(hour.dayOfWeek) || typeof hour.isClosed !== 'boolean' || typeof hour.closesNextDay !== 'boolean') return false;
    seen.add(hour.dayOfWeek);
    if (hour.isClosed) {
      if (hour.openTime !== null || hour.closeTime !== null || hour.closesNextDay) return false;
      continue;
    }
    if (typeof hour.openTime !== 'string' || typeof hour.closeTime !== 'string' ||
        !time.test(hour.openTime) || !time.test(hour.closeTime) || hour.openTime === hour.closeTime ||
        hour.closesNextDay !== (hour.closeTime < hour.openTime)) return false;
    if (openDayCount === 0) {
      sharedOpenTime = hour.openTime;
      sharedCloseTime = hour.closeTime;
    } else if (hour.openTime !== sharedOpenTime || hour.closeTime !== sharedCloseTime) {
      return false;
    }
    openDayCount += 1;
  }
  return openDayCount > 0;
};

const hoursForSelectedDays = (openTime: string, closeTime: string, openDaysMask: number): StoreHour[] => {
  const open = openTime.slice(0, 5);
  const close = closeTime.slice(0, 5);
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const isClosed = (openDaysMask & (1 << dayOfWeek)) === 0;
    return isClosed
      ? { dayOfWeek, isClosed: true, openTime: null, closeTime: null, closesNextDay: false }
      : { dayOfWeek, isClosed: false, openTime: open, closeTime: close, closesNextDay: close < open };
  });
};

export class StoreOperationsService {
  static async categories(): Promise<StoreCategory[]> {
    const [rows] = await db.query<(RowDataPacket & { category_id: number; category_name: string })[]>(
      `SELECT category_id, category_name FROM store_categories
       ORDER BY CASE category_name
         WHEN 'บาร์' THEN 1
         WHEN 'ผับ' THEN 2
         WHEN 'บาร์ไวท์' THEN 3
         WHEN 'รูฟท็อปบาร์' THEN 4
         WHEN 'ดราฟต์เบียร์' THEN 5
         WHEN 'เลาน์จ' THEN 6
         WHEN 'พื้นบ้าน' THEN 7
         WHEN 'คาเฟ่' THEN 8
         WHEN 'อื่นๆ' THEN 9
         ELSE 10 END, category_id`,
    );
    return rows.map(row => ({ id: Number(row.category_id), name: row.category_name }));
  }

  static async read(client: Pool | PoolConnection, storeIds: number[]): Promise<Map<number, StoreOperations>> {
    const result = new Map<number, StoreOperations>();
    if (!storeIds.length) return result;
    const placeholders = storeIds.map(() => '?').join(',');
    const [rows] = await client.query<RowDataPacket[]>(
      `SELECT s.store_id, s.open_time, s.close_time, s.open_days_mask, c.category_id, c.category_name
       FROM stores s
       INNER JOIN store_categories c ON c.category_id = s.category_id
       WHERE s.store_id IN (${placeholders})`,
      storeIds,
    );
    for (const row of rows) {
      result.set(Number(row.store_id), {
        category: { id: Number(row.category_id), name: String(row.category_name) },
        hours: hoursForSelectedDays(String(row.open_time), String(row.close_time), Number(row.open_days_mask)),
      });
    }
    return result;
  }

  static async save(connection: PoolConnection, storeId: number, input: StoreOperationsInput): Promise<void> {
    if (!isStoreHours(input.hours)) {
      throw new AppError(422, 'INVALID_STORE_HOURS', 'กรุณาเลือกวันเปิดร้านอย่างน้อย 1 วัน และระบุเวลาเปิด–ปิดชุดเดียวกันโดยเวลาเปิดกับเวลาปิดต้องต่างกัน');
    }
    const [categories] = await connection.query<RowDataPacket[]>(
      'SELECT category_id FROM store_categories WHERE category_id = ? FOR UPDATE', [input.categoryId],
    );
    if (!categories.length) throw new AppError(422, 'INVALID_STORE_CATEGORY', 'กรุณาเลือกประเภทร้าน');
    const first = input.hours.find(hour => !hour.isClosed)!;
    const openDaysMask = input.hours.reduce((mask, hour) => hour.isClosed ? mask : mask | (1 << hour.dayOfWeek), 0);
    await connection.query(
      'UPDATE stores SET category_id = ?, open_time = ?, close_time = ?, open_days_mask = ? WHERE store_id = ?',
      [input.categoryId, first.openTime, first.closeTime, openDaysMask, storeId],
    );
  }
}
