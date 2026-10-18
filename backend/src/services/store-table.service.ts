import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { db } from '../config/db';
import { AppError } from '../errors/app-error';

export type StoreTableStatus = 'ACTIVE' | 'INACTIVE';

export interface StoreTableView {
  id: number;
  storeId: number;
  tableNumber: string;
  seatCapacity: number;
  status: StoreTableStatus;
  positionX: number | null;
  positionY: number | null;
  createdAt: Date;
}

export interface StoreTableInput {
  tableNumber: string;
  seatCapacity: number;
  status: StoreTableStatus;
}

interface StoreTableRow extends RowDataPacket {
  table_id: number;
  store_id: number;
  table_number: string;
  seat_capacity: number;
  status: StoreTableStatus;
  position_x: string | number | null;
  position_y: string | number | null;
  created_at: Date;
}

interface OwnedStoreRow extends RowDataPacket {
  store_id: number;
  status: string;
}

const tableSelect = `table_id, store_id, table_number, seat_capacity, status, position_x, position_y, created_at`;

export class StoreTableService {
  private static view(row: StoreTableRow): StoreTableView {
    return {
      id: Number(row.table_id),
      storeId: Number(row.store_id),
      tableNumber: row.table_number,
      seatCapacity: Number(row.seat_capacity),
      status: row.status,
      positionX: row.position_x == null ? null : Number(row.position_x),
      positionY: row.position_y == null ? null : Number(row.position_y),
      createdAt: row.created_at,
    };
  }

  private static async assertManageableStore(
    connection: PoolConnection,
    userId: number,
    storeId: number,
    lock = false,
  ): Promise<void> {
    const [rows] = await connection.query<OwnedStoreRow[]>(
      `SELECT store_id, status FROM stores
       WHERE store_id = ? AND owner_user_id = ?${lock ? ' FOR UPDATE' : ''}`,
      [storeId, userId],
    );
    const store = rows[0];
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'ไม่พบร้านค้าของคุณ');
    if (!['OPEN', 'CLOSED'].includes(store.status)) {
      throw new AppError(409, 'STORE_NOT_APPROVED', 'ร้านต้องได้รับอนุมัติก่อนจึงจะจัดการโต๊ะได้');
    }
  }

  private static async findOwnedTable(
    connection: PoolConnection,
    storeId: number,
    tableId: number,
    lock = false,
  ): Promise<StoreTableRow> {
    const [rows] = await connection.query<StoreTableRow[]>(
      `SELECT ${tableSelect} FROM store_tables
       WHERE table_id = ? AND store_id = ?${lock ? ' FOR UPDATE' : ''}`,
      [tableId, storeId],
    );
    if (!rows[0]) throw new AppError(404, 'STORE_TABLE_NOT_FOUND', 'ไม่พบโต๊ะที่ต้องการ');
    return rows[0];
  }

  private static duplicateError(error: unknown): never {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'DUPLICATE_TABLE_NUMBER', 'หมายเลขโต๊ะนี้มีอยู่ในร้านแล้ว');
    }
    throw error;
  }

  static async listOwned(userId: number, storeId: number): Promise<StoreTableView[]> {
    const connection = await db.getConnection();
    try {
      await this.assertManageableStore(connection, userId, storeId);
      const [rows] = await connection.query<StoreTableRow[]>(
        `SELECT ${tableSelect} FROM store_tables
         WHERE store_id = ? ORDER BY table_number, table_id`,
        [storeId],
      );
      return rows.map(row => this.view(row));
    } finally {
      connection.release();
    }
  }

  static async createOwned(userId: number, storeId: number, input: StoreTableInput): Promise<StoreTableView> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await this.assertManageableStore(connection, userId, storeId, true);
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO store_tables (store_id, table_number, seat_capacity, status)
         VALUES (?, ?, ?, ?)`,
        [storeId, input.tableNumber, input.seatCapacity, input.status],
      );
      const created = await this.findOwnedTable(connection, storeId, result.insertId);
      await connection.commit();
      return this.view(created);
    } catch (error) {
      await connection.rollback();
      this.duplicateError(error);
    } finally {
      connection.release();
    }
  }

  static async updateOwned(
    userId: number,
    storeId: number,
    tableId: number,
    input: StoreTableInput,
  ): Promise<StoreTableView> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await this.assertManageableStore(connection, userId, storeId, true);
      const before = await this.findOwnedTable(connection, storeId, tableId, true);
      await connection.query(
        `UPDATE store_tables
         SET table_number = ?, seat_capacity = ?, status = ?
         WHERE table_id = ? AND store_id = ?`,
        [input.tableNumber, input.seatCapacity, input.status, tableId, storeId],
      );
      const updated = await this.findOwnedTable(connection, storeId, tableId);
      await connection.commit();
      return this.view(updated);
    } catch (error) {
      await connection.rollback();
      this.duplicateError(error);
    } finally {
      connection.release();
    }
  }

  static async deleteOwned(userId: number, storeId: number, tableId: number): Promise<void> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await this.assertManageableStore(connection, userId, storeId, true);
      const before = await this.findOwnedTable(connection, storeId, tableId, true);
      const [bookings] = await connection.query<RowDataPacket[]>(
        `SELECT booking_id FROM booking WHERE table_id = ?
         UNION SELECT booking_id FROM booking_extra_tables WHERE table_id = ? LIMIT 1`, [tableId, tableId]);
      if (bookings.length) throw new AppError(409, 'TABLE_HAS_BOOKINGS', 'โต๊ะนี้มีประวัติการจอง กรุณาปิดใช้งานโต๊ะแทนการลบ');
      await connection.query('DELETE FROM store_tables WHERE table_id = ? AND store_id = ?', [tableId, storeId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
