import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { db } from '../config/db';
import { AppError } from '../errors/app-error';
import { arrivalFor, serviceWindow } from './booking-time';

export interface BookingInput {
  storeId: number;
  tableId?: number;
  tableIds?: number[];
  serviceDate: string;
  arrivalTime: string;
  peopleCount: number;
}

// The twelve-column booking table stores the customer's actual Bangkok arrival date.
// A reservation after midnight belongs to the previous opening date.
const serviceDateExpression = `CASE WHEN s.close_time <= s.open_time AND b.booking_time < s.open_time
  THEN DATE_SUB(b.booking_date, INTERVAL 1 DAY) ELSE b.booking_date END`;
const selectBooking = `SELECT b.*, DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS arrival_date,
  DATE_FORMAT(${serviceDateExpression}, '%Y-%m-%d') AS service_date,
  s.store_name, s.phone AS store_phone, s.close_time AS store_close_time,
  (SELECT sp.file_url FROM store_photo sp WHERE sp.store_id = s.store_id
    ORDER BY sp.is_cover DESC, sp.photo_id LIMIT 1) AS cover_image_url,
  COALESCE(x.cancel_before_days, 0) AS cancel_days,
  u.full_name AS contact_name, u.phone_number AS contact_phone, t.table_number,
  (SELECT GROUP_CONCAT(extra_table.table_number ORDER BY extra_table.table_number SEPARATOR ', ')
    FROM booking_extra_tables extra
    JOIN store_tables extra_table ON extra_table.table_id = extra.table_id
    WHERE extra.booking_id = b.booking_id) AS extra_table_numbers,
  (SELECT COUNT(*) FROM booking_extra_tables extra WHERE extra.booking_id = b.booking_id) AS extra_table_count
  FROM booking b JOIN stores s ON s.store_id = b.store_id
  JOIN users u ON u.user_id = b.user_id
  LEFT JOIN store_tables t ON t.table_id = b.table_id
  LEFT JOIN setting x ON x.store_id = b.store_id`;

function view(row: RowDataPacket) {
  const arrival = new Date(`${row.arrival_date}T${String(row.booking_time).slice(0, 5)}:00+07:00`);
  const deadline = new Date(arrival.getTime() - Number(row.cancel_days) * 86400000);
  return {
    id: Number(row.booking_id), code: `DG-${row.booking_id}`,
    storeId: Number(row.store_id), storeName: row.store_name, storePhone: row.store_phone,
    coverImageUrl: row.cover_image_url || null, storeCloseTime: row.store_close_time ? String(row.store_close_time).slice(0, 5) : null,
    tableId: row.table_id == null ? null : Number(row.table_id),
    tableNumber: [row.table_number, row.extra_table_numbers].filter(Boolean).join(', ') || 'ไม่ระบุ',
    tableCount: (row.table_id == null ? 0 : 1) + Number(row.extra_table_count || 0),
    serviceDate: row.service_date, arrivalAt: arrival.toISOString(),
    arrivalTime: String(row.booking_time).slice(0, 5), peopleCount: Number(row.people_count),
    contactName: row.contact_name, contactPhone: row.contact_phone,
    bookingPrice: Number(row.booking_price), totalPrice: Number(row.total_price), status: row.status,
    cancellationDeadline: deadline.toISOString(),
    canCancel: row.status === 'CONFIRMED' && Date.now() < deadline.getTime(),
    canComplete: row.status === 'CONFIRMED' && Date.now() >= arrival.getTime(),
  };
}

export class BookingService {
  private static async store(connection: PoolConnection, storeId: number, date: string, lock = false) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT s.*, COALESCE(x.is_booking_enabled, 1) AS booking_enabled,
       COALESCE(x.cancel_before_days, 0) AS cancel_days, x.booking_policy_text, x.cancellation_policy_text
       FROM stores s LEFT JOIN setting x ON x.store_id = s.store_id
       WHERE s.store_id = ?${lock ? ' FOR UPDATE' : ''}`, [storeId]);
    const store = rows[0];
    if (!store || store.approval_status !== 'APPROVED') throw new AppError(404, 'STORE_NOT_FOUND', 'ไม่พบร้านค้า');
    if (store.status !== 'OPEN' || !store.booking_enabled) throw new AppError(409, 'BOOKING_DISABLED', 'ร้านยังไม่เปิดรับจอง');
    const window = serviceWindow(date, String(store.open_time), String(store.close_time));
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    if (!(Number(store.open_days_mask) & (1 << weekday))) throw new AppError(409, 'STORE_CLOSED', 'ร้านหยุดให้บริการในวันที่เลือก');
    const [closed] = await connection.query<RowDataPacket[]>(
      'SELECT close_setting_id FROM close_setting WHERE store_id = ? AND start_date <= ? AND end_date >= ?', [storeId, date, date]);
    if (closed.length) throw new AppError(409, 'STORE_CLOSED', 'ร้านปิดรับจองในวันที่เลือก');
    if (window.end.getTime() <= Date.now()) throw new AppError(422, 'PAST_DATE', 'ไม่สามารถจองคืนที่สิ้นสุดบริการแล้ว');
    return store;
  }

  static async availability(storeId: number, date: string, peopleCount: number) {
    const connection = await db.getConnection();
    try {
      const store = await this.store(connection, storeId, date);
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT t.*, EXISTS(
           SELECT 1 FROM booking b JOIN stores s ON s.store_id = b.store_id
           WHERE (b.table_id = t.table_id OR EXISTS(
             SELECT 1 FROM booking_extra_tables extra
             WHERE extra.booking_id = b.booking_id AND extra.table_id = t.table_id
           )) AND b.status <> 'CANCELLED'
             AND ${serviceDateExpression} = ?
         ) AS booked
         FROM store_tables t WHERE t.store_id = ? ORDER BY t.table_number, t.table_id`, [date, storeId]);
      return {
        storeId, storeName: store.store_name, serviceDate: date, openTime: String(store.open_time).slice(0, 5),
        closeTime: String(store.close_time).slice(0, 5), layoutImageUrl: store.layout_image_url,
        cancelBeforeDays: Number(store.cancel_days), bookingPolicy: store.booking_policy_text,
        cancellationPolicy: store.cancellation_policy_text,
        tables: rows.map(row => ({ id: Number(row.table_id), tableNumber: row.table_number,
          seatCapacity: Number(row.seat_capacity), positionX: row.position_x == null ? null : Number(row.position_x),
          positionY: row.position_y == null ? null : Number(row.position_y),
          state: row.status !== 'ACTIVE' ? 'INACTIVE' : row.booked ? 'BOOKED' : Number(row.seat_capacity) < peopleCount ? 'TOO_SMALL' : 'AVAILABLE',
        })),
      };
    } finally { connection.release(); }
  }

  static async create(userId: number, input: BookingInput) {
    const requestedIds = input.tableIds ?? (input.tableId === undefined ? [] : [input.tableId]);
    if ((input.tableIds !== undefined && input.tableId !== undefined) || requestedIds.length < 1 || requestedIds.length > 20 ||
        requestedIds.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(requestedIds).size !== requestedIds.length) {
      throw new AppError(422, 'INVALID_TABLE_SELECTION', 'กรุณาเลือกโต๊ะที่ไม่ซ้ำกันอย่างน้อยหนึ่งโต๊ะ');
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      // Lock the member before the store so two simultaneous requests cannot
      // reserve different stores for the same service night.
      const [users] = await connection.query<RowDataPacket[]>(
        'SELECT phone_number FROM users WHERE user_id = ? FOR UPDATE', [userId]);
      if (!users[0]?.phone_number) throw new AppError(422, 'PROFILE_PHONE_REQUIRED', 'กรุณาเพิ่มเบอร์โทรในโปรไฟล์ก่อนจองโต๊ะ');
      // Store locking serializes competing requests for the same tables.
      const store = await this.store(connection, input.storeId, input.serviceDate, true);
      const arrival = arrivalFor(input.serviceDate, input.arrivalTime, String(store.open_time), String(store.close_time));
      if (arrival.getTime() <= Date.now()) throw new AppError(422, 'PAST_TIME', 'เวลาเข้าร้านต้องเป็นเวลาในอนาคต');
      const placeholders = requestedIds.map(() => '?').join(', ');
      const [tables] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM store_tables WHERE store_id = ? AND table_id IN (${placeholders}) ORDER BY table_id FOR UPDATE`,
        [input.storeId, ...requestedIds]);
      if (tables.length !== requestedIds.length || tables.some(table => table.status !== 'ACTIVE')) {
        throw new AppError(409, 'TABLE_UNAVAILABLE', 'มีโต๊ะที่ไม่เปิดรับจอง กรุณาตรวจสอบอีกครั้ง');
      }
      if (tables.reduce((sum, table) => sum + Number(table.seat_capacity), 0) < input.peopleCount) {
        throw new AppError(422, 'TABLE_TOO_SMALL', 'จำนวนคนเกินที่นั่งรวมของโต๊ะที่เลือก');
      }
      const [mine] = await connection.query<RowDataPacket[]>(
        `SELECT b.booking_id, b.store_id, b.table_id, b.booking_time, b.people_count, b.status
         FROM booking b JOIN stores s ON s.store_id = b.store_id
         WHERE b.user_id = ? AND b.status <> 'CANCELLED' AND ${serviceDateExpression} = ? FOR UPDATE`,
        [userId, input.serviceDate]);
      if (mine.length) {
        const previous = mine[0];
        if (mine.length === 1 && Number(previous.store_id) === input.storeId && previous.status === 'CONFIRMED' &&
            String(previous.booking_time).slice(0, 5) === input.arrivalTime && Number(previous.people_count) === input.peopleCount) {
          const [extra] = await connection.query<RowDataPacket[]>(
            'SELECT table_id FROM booking_extra_tables WHERE booking_id = ?', [previous.booking_id]);
          const assignedIds = [Number(previous.table_id), ...extra.map(row => Number(row.table_id))];
          if (assignedIds.length === requestedIds.length && assignedIds.every(id => requestedIds.includes(id))) {
            const [replayed] = await connection.query<RowDataPacket[]>(`${selectBooking} WHERE b.booking_id = ?`, [previous.booking_id]);
            await connection.commit();
            return view(replayed[0]);
          }
        }
        throw new AppError(409, 'BOOKING_LIMIT', 'คุณมีรายการจองสำหรับคืนนี้แล้ว');
      }
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT b.booking_id, b.user_id, b.table_id, b.booking_time, b.people_count, b.status
         FROM booking b JOIN stores s ON s.store_id = b.store_id
         WHERE b.store_id = ? AND b.status <> 'CANCELLED' AND ${serviceDateExpression} = ?
           AND (b.table_id IN (${placeholders}) OR EXISTS(
             SELECT 1 FROM booking_extra_tables extra
             WHERE extra.booking_id = b.booking_id AND extra.table_id IN (${placeholders})
           )) FOR UPDATE`,
        [input.storeId, input.serviceDate, ...requestedIds, ...requestedIds]);
      if (existing.length) {
        throw new AppError(409, 'BOOKING_CONFLICT', 'มีโต๊ะที่ถูกจองในคืนที่เลือกแล้ว กรุณาตรวจสอบโต๊ะว่างอีกครั้ง');
      }
      const arrivalDate = new Date(arrival.getTime() + 7 * 3600000).toISOString().slice(0, 10);
      const orderedIds = tables.sort((a, b) => String(a.table_number).localeCompare(String(b.table_number)))
        .map(table => Number(table.table_id));
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO booking (user_id, store_id, table_id, booking_date, booking_time, people_count,
         booking_price, total_price, status, slip_image) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'CONFIRMED', NULL)`,
        [userId, input.storeId, orderedIds[0], arrivalDate, input.arrivalTime, input.peopleCount]);
      for (const tableId of orderedIds.slice(1)) {
        await connection.query('INSERT INTO booking_extra_tables (booking_id, table_id) VALUES (?, ?)', [result.insertId, tableId]);
      }
      const [created] = await connection.query<RowDataPacket[]>(`${selectBooking} WHERE b.booking_id = ?`, [result.insertId]);
      await connection.commit();
      return view(created[0]);
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  static async listMine(userId: number) {
    const [rows] = await db.query<RowDataPacket[]>(`${selectBooking} WHERE b.user_id = ? ORDER BY b.booking_date DESC, b.booking_id DESC`, [userId]);
    return rows.map(view);
  }

  static async listOwned(userId: number, storeId: number, date: string) {
    const [stores] = await db.query<RowDataPacket[]>('SELECT store_name FROM stores WHERE store_id = ? AND owner_user_id = ?', [storeId, userId]);
    if (!stores[0]) throw new AppError(404, 'STORE_NOT_FOUND', 'ไม่พบร้านค้าของคุณ');
    const [rows] = await db.query<RowDataPacket[]>(`${selectBooking} WHERE b.store_id = ? AND s.owner_user_id = ?
      AND ${serviceDateExpression} = ? ORDER BY b.booking_date, b.booking_time, b.booking_id`, [storeId, userId, date]);
    return { storeName: stores[0].store_name, bookings: rows.map(view) };
  }

  static async changeStatus(userId: number, bookingId: number, status: 'CANCELLED' | 'COMPLETED', storeId?: number) {
    const connection = await db.getConnection();
    const scopeCondition = storeId === undefined ? 'b.user_id = ?' : 's.owner_user_id = ? AND b.store_id = ?';
    const scopeValues = storeId === undefined ? [bookingId, userId] : [bookingId, userId, storeId];
    try {
      await connection.beginTransaction();
      const [scope] = await connection.query<RowDataPacket[]>(`${selectBooking} WHERE b.booking_id = ? AND ${scopeCondition}`, scopeValues);
      if (!scope[0]) throw new AppError(404, 'BOOKING_NOT_FOUND', 'ไม่พบรายการจอง');
      await connection.query('SELECT store_id FROM stores WHERE store_id = ? FOR UPDATE', [scope[0].store_id]);
      const [rows] = await connection.query<RowDataPacket[]>(`${selectBooking} WHERE b.booking_id = ? AND ${scopeCondition} FOR UPDATE`, scopeValues);
      const row = rows[0];
      if (!row) throw new AppError(404, 'BOOKING_NOT_FOUND', 'ไม่พบรายการจอง');
      if (row.status !== status) {
        if (row.status !== 'CONFIRMED') throw new AppError(409, 'INVALID_STATUS', 'รายการนี้ไม่สามารถเปลี่ยนสถานะได้');
        const booking = view(row);
        if (storeId === undefined && (status !== 'CANCELLED' || !booking.canCancel)) throw new AppError(409, 'CANCELLATION_CLOSED', 'พ้นกำหนดยกเลิกแล้ว กรุณาติดต่อร้าน');
        if (status === 'COMPLETED' && !booking.canComplete) throw new AppError(409, 'NOT_ARRIVED', 'ยังไม่ถึงเวลาเข้าใช้บริการ');
        await connection.query('UPDATE booking SET status = ? WHERE booking_id = ?', [status, bookingId]);
      }
      const [updated] = await connection.query<RowDataPacket[]>(`${selectBooking} WHERE b.booking_id = ?`, [bookingId]);
      await connection.commit();
      return view(updated[0]);
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
}
