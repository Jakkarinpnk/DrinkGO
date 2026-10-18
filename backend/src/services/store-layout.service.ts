import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { db } from '../config/db';
import { AppError } from '../errors/app-error';
import { StoreTableStatus } from './store-table.service';

export type LayoutBookingStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'PENDING_PAYMENT' | 'BOOKED';

export interface LayoutTableView {
  id: number;
  tableNumber: string;
  seatCapacity: number;
  status: StoreTableStatus;
  positionX: number | null;
  positionY: number | null;
  layoutStatus: LayoutBookingStatus;
}

export interface StoreLayoutView {
  storeId: number;
  imageUrl: string | null;
  tables: LayoutTableView[];
}

export interface LayoutTablePositionInput {
  id: number;
  positionX: number | null;
  positionY: number | null;
  status: StoreTableStatus;
}

interface LayoutStoreRow extends RowDataPacket {
  store_id: number;
  status: string;
  layout_image_url: string | null;
}

interface LayoutTableRow extends RowDataPacket {
  table_id: number;
  table_number: string;
  seat_capacity: number;
  status: StoreTableStatus;
  position_x: string | number | null;
  position_y: string | number | null;
}

export const storeLayoutDirectory = path.resolve(__dirname, '../../uploads/store-layouts');

export class StoreLayoutService {
  private static async ownedStore(
    connection: PoolConnection,
    userId: number,
    storeId: number,
    lock = false,
  ): Promise<LayoutStoreRow> {
    const [rows] = await connection.query<LayoutStoreRow[]>(
      `SELECT store_id, status, layout_image_url
       FROM stores
       WHERE store_id = ? AND owner_user_id = ?${lock ? ' FOR UPDATE' : ''}`,
      [storeId, userId],
    );
    const store = rows[0];
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'ไม่พบร้านค้าของคุณ');
    if (!['OPEN', 'CLOSED'].includes(store.status)) {
      throw new AppError(409, 'STORE_NOT_APPROVED', 'ร้านต้องได้รับอนุมัติก่อนจึงจะจัดการ Layout ได้');
    }
    return store;
  }

  private static async tables(connection: PoolConnection, storeId: number): Promise<LayoutTableView[]> {
    const [rows] = await connection.query<LayoutTableRow[]>(
      `SELECT table_id, table_number, seat_capacity, status, position_x, position_y
       FROM store_tables WHERE store_id = ? ORDER BY table_number, table_id`,
      [storeId],
    );
    return rows.map(row => ({
      id: Number(row.table_id),
      tableNumber: row.table_number,
      seatCapacity: Number(row.seat_capacity),
      status: row.status,
      positionX: row.position_x == null ? null : Number(row.position_x),
      positionY: row.position_y == null ? null : Number(row.position_y),
        // This editor shows permanent table state; dated availability is served by BookingService.
      layoutStatus: row.status === 'ACTIVE' ? 'AVAILABLE' : 'UNAVAILABLE',
    }));
  }

  private static view(store: LayoutStoreRow, tables: LayoutTableView[]): StoreLayoutView {
    return {
      storeId: Number(store.store_id),
      imageUrl: store.layout_image_url,
      tables,
    };
  }

  private static verifyImage(file: Express.Multer.File): void {
    const bytes = file.buffer;
    const valid =
      (file.mimetype === 'image/png' && bytes.length >= 33 &&
        bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        bytes.subarray(12, 16).toString() === 'IHDR') ||
      (file.mimetype === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 &&
        bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) ||
      (file.mimetype === 'image/webp' && bytes.length >= 16 && bytes.subarray(0, 4).toString() === 'RIFF' &&
        bytes.subarray(8, 12).toString() === 'WEBP' && bytes.readUInt32LE(4) === bytes.length - 8);
    if (!valid) throw new AppError(422, 'INVALID_LAYOUT_IMAGE_CONTENT', 'เนื้อหาไฟล์ไม่ตรงกับชนิดรูป Layout');
  }

  static async getOwned(userId: number, storeId: number): Promise<StoreLayoutView> {
    const connection = await db.getConnection();
    try {
      const store = await this.ownedStore(connection, userId, storeId);
      return this.view(store, await this.tables(connection, storeId));
    } finally {
      connection.release();
    }
  }

  static async saveImage(userId: number, storeId: number, file?: Express.Multer.File): Promise<StoreLayoutView> {
    if (!file) throw new AppError(422, 'LAYOUT_IMAGE_REQUIRED', 'กรุณาเลือกรูป Layout');
    this.verifyImage(file);
    const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
    const filename = `${crypto.randomUUID()}${extension}`;
    const diskPath = path.join(storeLayoutDirectory, filename);
    const connection = await db.getConnection();
    let previousPath: string | null = null;
    try {
      await fs.mkdir(storeLayoutDirectory, { recursive: true });
      await fs.writeFile(diskPath, file.buffer, { flag: 'wx' });
      await connection.beginTransaction();
      const before = await this.ownedStore(connection, userId, storeId, true);
      if (before.layout_image_url?.startsWith('/uploads/store-layouts/')) {
        previousPath = path.join(storeLayoutDirectory, path.basename(before.layout_image_url));
      }
      await connection.query(
        `UPDATE stores
         SET layout_image_url = ?
         WHERE store_id = ? AND owner_user_id = ?`,
        [`/uploads/store-layouts/${filename}`, storeId, userId],
      );
      const after = await this.ownedStore(connection, userId, storeId);
      const layout = this.view(after, await this.tables(connection, storeId));
      await connection.commit();
      if (previousPath && previousPath !== diskPath) await fs.unlink(previousPath).catch(() => undefined);
      return layout;
    } catch (error) {
      await connection.rollback();
      await fs.unlink(diskPath).catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteImage(userId: number, storeId: number): Promise<StoreLayoutView> {
    const connection = await db.getConnection();
    let retiredPath: string | null = null;
    try {
      await connection.beginTransaction();
      const before = await this.ownedStore(connection, userId, storeId, true);
      if (!before.layout_image_url) throw new AppError(404, 'STORE_LAYOUT_NOT_FOUND', 'ร้านนี้ยังไม่มีรูป Layout');
      if (before.layout_image_url.startsWith('/uploads/store-layouts/')) {
        retiredPath = path.join(storeLayoutDirectory, path.basename(before.layout_image_url));
      }
      await connection.query(
        `UPDATE stores
         SET layout_image_url = NULL
         WHERE store_id = ? AND owner_user_id = ?`,
        [storeId, userId],
      );
      await connection.query('UPDATE store_tables SET position_x = NULL, position_y = NULL WHERE store_id = ?', [storeId]);
      const after = await this.ownedStore(connection, userId, storeId);
      const layout = this.view(after, await this.tables(connection, storeId));
      await connection.commit();
      if (retiredPath) await fs.unlink(retiredPath).catch(() => undefined);
      return layout;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async saveTables(
    userId: number,
    storeId: number,
    inputs: LayoutTablePositionInput[],
  ): Promise<StoreLayoutView> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const store = await this.ownedStore(connection, userId, storeId, true);
      if (!store.layout_image_url) throw new AppError(409, 'STORE_LAYOUT_REQUIRED', 'กรุณาเพิ่มรูป Layout ก่อนจัดวางโต๊ะ');
      const ids = inputs.map(input => input.id);
      if (new Set(ids).size !== ids.length) throw new AppError(422, 'DUPLICATE_LAYOUT_TABLE', 'มีข้อมูลโต๊ะซ้ำใน Layout');
      const [ownedRows] = await connection.query<RowDataPacket[]>(
        'SELECT table_id FROM store_tables WHERE store_id = ? FOR UPDATE',
        [storeId],
      );
      const ownedIds = new Set(ownedRows.map(row => Number(row.table_id)));
      if (inputs.some(input => !ownedIds.has(input.id))) {
        throw new AppError(422, 'INVALID_LAYOUT_TABLE', 'พบโต๊ะที่ไม่ได้อยู่ในร้านนี้');
      }
      for (const input of inputs) {
        await connection.query(
          `UPDATE store_tables SET position_x = ?, position_y = ?, status = ?
           WHERE table_id = ? AND store_id = ?`,
          [input.positionX, input.positionY, input.status, input.id, storeId],
        );
      }
      const refreshed = await this.ownedStore(connection, userId, storeId);
      const layout = this.view(refreshed, await this.tables(connection, storeId));
      await connection.commit();
      return layout;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
