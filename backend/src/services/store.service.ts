import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { db } from '../config/db';
import { AppError } from '../errors/app-error';
import { StoreOperations, StoreOperationsInput, StoreOperationsService } from './store-operations.service';
import { MenuFileService, MenuFileView } from './menu-file.service';

export type StoreServiceStatus = 'OPEN' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
export type StoreApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type DatabaseStoreStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'REJECTED' | 'SUSPENDED';
export interface StoreSearch { name?: string; categoryId?: number; location?: string; }
export interface StoreLocation { label: string; value: string; }

export interface StoreSummary extends Partial<StoreOperations> {
  id: number;
  name: string;
  description: string | null;
  province: string;
  googleMapUrl: string;
  serviceStatus: StoreServiceStatus;
  coverImageUrl?: string | null;
}

export interface PublicStoreDetail extends StoreSummary {
  phone: string;
  lineUrl: string;
  addressLine: string;
  images: StoreImage[];
  menuFiles: MenuFileView[];
  layout: PublicStoreLayout;
}

export interface PublicLayoutTable {
  id: number;
  tableNumber: string;
  seatCapacity: number;
  positionX: number;
  positionY: number;
  layoutStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'PENDING_PAYMENT' | 'BOOKED';
}
export interface PublicStoreLayout { imageUrl: string | null; tables: PublicLayoutTable[]; }

export interface OwnedStoreSummary extends StoreSummary {
  phone: string;
  lineUrl: string;
  addressLine: string;
  approvalStatus: StoreApprovalStatus;
}

export type StoreUpdateInput = Pick<OwnedStoreSummary,
  'name' | 'description' | 'phone' | 'lineUrl' | 'addressLine' |
  'province' | 'googleMapUrl' | 'serviceStatus'> & StoreOperationsInput;

export interface StoreImage { id: number; url: string; altText: string | null; isCover: boolean; }
export interface OwnedStoreDetail extends OwnedStoreSummary { images: StoreImage[]; menuFiles: MenuFileView[]; }
export interface StoreImageChanges { removedImageIds: number[]; coverImageId?: number; newCoverIndex?: number; }
export interface StoreFileChanges extends StoreImageChanges { removedMenuFileIds: number[]; }
export const storeImageDirectory = path.resolve(__dirname, '../../uploads/store-images');
interface ImageRow extends RowDataPacket { id: number; file_url: string; is_cover: number; }
interface PublicLayoutTableRow extends RowDataPacket {
  table_id: number;
  table_number: string;
  seat_capacity: number;
  status: 'ACTIVE' | 'INACTIVE';
  position_x: string | number;
  position_y: string | number;
}

const coverSelect = `(SELECT sp.file_url FROM store_photo sp
  WHERE sp.store_id = stores.store_id
  ORDER BY sp.is_cover DESC, sp.photo_id LIMIT 1) AS cover_image_url`;

const addressLineSelect = `SUBSTRING_INDEX(stores.address, '\nจังหวัด:', 1)`;
const provinceSelect = `TRIM(SUBSTRING_INDEX(stores.address, '\nจังหวัด:', -1))`;
const approvalStatusSelect = 'stores.approval_status';
const serviceStatusSelect = `CASE
  WHEN stores.status = 'OPEN' THEN 'OPEN'
  WHEN stores.status = 'CLOSED' THEN 'CLOSED_TEMPORARILY'
  ELSE 'CLOSED_TEMPORARILY' END`;
const storeSelect = `stores.store_id AS id, stores.store_name AS name, stores.description,
  stores.phone, stores.line_contact AS line_url, ${addressLineSelect} AS address_line,
  ${provinceSelect} AS province, stores.google_map_url,
  ${approvalStatusSelect} AS approval_status, ${serviceStatusSelect} AS service_status,
  stores.business_license_url, stores.layout_image_url, ${coverSelect}`;

interface StoreSummaryRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  province: string;
  google_map_url: string;
  service_status: StoreServiceStatus;
  cover_image_url?: string | null;
}

interface OwnedStoreSummaryRow extends StoreSummaryRow {
  phone: string;
  line_url: string;
  address_line: string;
  approval_status: StoreApprovalStatus;
  business_license_url: string;
  layout_image_url: string | null;
}

export class StoreService {
  private static ownedView(row: OwnedStoreSummaryRow): OwnedStoreSummary {
    return {
      id: Number(row.id), name: row.name, description: row.description, phone: row.phone,
      lineUrl: row.line_url, addressLine: row.address_line,
      province: row.province, googleMapUrl: row.google_map_url,
      approvalStatus: row.approval_status, serviceStatus: row.service_status,
      coverImageUrl: row.cover_image_url || null,
    };
  }
  private static async lockOwned(connection: PoolConnection, userId: number, storeId: number): Promise<OwnedStoreSummaryRow> {
    const [rows] = await connection.query<OwnedStoreSummaryRow[]>(
      `SELECT ${storeSelect} FROM stores WHERE store_id = ? AND owner_user_id = ? FOR UPDATE`,
      [storeId, userId],
    );
    if (!rows[0]) throw new AppError(404, 'STORE_NOT_FOUND', 'ไม่พบร้านค้าของคุณ');
    return rows[0];
  }

  private static async images(client: Pool | PoolConnection, storeId: number): Promise<ImageRow[]> {
    const [rows] = await client.query<ImageRow[]>(
      `SELECT photo_id AS id, file_url, is_cover
       FROM store_photo
       WHERE store_id = ? ORDER BY photo_id`, [storeId],
    );
    return rows;
  }

  private static imageView(rows: ImageRow[]): StoreImage[] {
    return rows.map(row => ({ id: Number(row.id), url: row.file_url, altText: null, isCover: Boolean(row.is_cover) }));
  }

  private static async publicLayout(storeId: number, imageUrl: string | null): Promise<PublicStoreLayout> {
    const [rows] = await db.query<PublicLayoutTableRow[]>(
      `SELECT table_id, table_number, seat_capacity, status, position_x, position_y
       FROM store_tables
       WHERE store_id = ? AND position_x IS NOT NULL AND position_y IS NOT NULL
       ORDER BY table_number, table_id`,
      [storeId],
    );
    return {
      imageUrl,
      tables: rows.map(table => ({
        id: Number(table.table_id),
        tableNumber: table.table_number,
        seatCapacity: Number(table.seat_capacity),
        positionX: Number(table.position_x),
        positionY: Number(table.position_y),
        // Undated layout shows permanent table state; booking availability requires a service date.
        layoutStatus: table.status === 'ACTIVE' ? 'AVAILABLE' : 'UNAVAILABLE',
      })),
    };
  }

  static async getOwned(userId: number, storeId: number): Promise<OwnedStoreDetail> {
    const connection = await db.getConnection();
    try {
      const row = await this.lockOwned(connection, userId, storeId);
      return {
        ...this.ownedView(row), ...((await StoreOperationsService.read(connection, [storeId])).get(storeId)),
        images: this.imageView(await this.images(connection, storeId)), menuFiles: await MenuFileService.read(connection, storeId),
      };
    } finally { connection.release(); }
  }

  static async updateOwned(userId: number, storeId: number, input: StoreUpdateInput,
    uploads: Express.Multer.File[] = [], menuUploads: Express.Multer.File[] = [],
    changes: StoreFileChanges = { removedImageIds: [], removedMenuFileIds: [] }): Promise<OwnedStoreDetail> {
    const createdPaths: string[] = [];
    const retiredPaths: string[] = [];
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('SELECT user_id FROM users WHERE user_id = ? FOR UPDATE', [userId]);
      const before = await this.lockOwned(connection, userId, storeId);
      if (before.approval_status === 'PENDING' || before.approval_status === 'APPROVED') {
        const inputKey = [input.name, input.phone, input.addressLine]
          .map(value => value.trim().toLocaleLowerCase('th-TH')).join('|');
        const [otherStores] = await connection.query<(RowDataPacket & { store_name: string; phone: string; address: string })[]>(
          `SELECT store_name, phone, address FROM stores
           WHERE owner_user_id = ? AND store_id <> ?
             AND approval_status IN ('PENDING', 'APPROVED') FOR UPDATE`, [userId, storeId],
        );
        if (otherStores.some(store => [store.store_name, store.phone, store.address.split('\nจังหวัด:')[0]]
          .map(value => value.trim().toLocaleLowerCase('th-TH')).join('|') === inputKey)) {
          throw new AppError(409, 'DUPLICATE_STORE', 'มีร้านชื่อ เบอร์โทร และที่อยู่นี้อยู่แล้วในบัญชีของคุณ');
        }
      }
      const beforeOperations = (await StoreOperationsService.read(connection, [storeId])).get(storeId);
      await StoreOperationsService.save(connection, storeId, input);
      const existing = await this.images(connection, storeId);
      const removed = new Set(changes.removedImageIds);
      if ([...removed].some(id => !existing.some(image => Number(image.id) === id))) {
        throw new AppError(422, 'INVALID_STORE_IMAGE_ID', 'ไม่พบรูปภาพที่ต้องการนำออกจากร้านนี้');
      }
      const remaining = existing.filter(image => !removed.has(Number(image.id)));
      if (remaining.length + uploads.length > 10) throw new AppError(422, 'TOO_MANY_STORE_IMAGES', 'ร้านมีรูปภาพได้ไม่เกิน 10 รูป');
      if ((changes.coverImageId !== undefined && !remaining.some(image => Number(image.id) === changes.coverImageId)) ||
          (changes.newCoverIndex !== undefined && changes.newCoverIndex >= uploads.length) ||
          (changes.coverImageId !== undefined && changes.newCoverIndex !== undefined)) {
        throw new AppError(422, 'INVALID_STORE_COVER', 'กรุณาเลือกรูปปกที่อยู่ในร้านนี้');
      }
      for (const upload of uploads) {
        if (upload.size > 5 * 1024 * 1024) throw new AppError(422, 'STORE_IMAGE_TOO_LARGE', 'แต่ละรูปต้องมีขนาดไม่เกิน 5 MB');
        const b = upload.buffer;
        const valid =
          (upload.mimetype === 'image/png' && b.length >= 33 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.subarray(12,16).toString() === 'IHDR') ||
          (upload.mimetype === 'image/jpeg' && b.length >= 4 && b[0] === 255 && b[1] === 216 && b[b.length-2] === 255 && b[b.length-1] === 217) ||
          (upload.mimetype === 'image/webp' && b.length >= 16 && b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP' && b.readUInt32LE(4) === b.length - 8);
        if (!valid) throw new AppError(422, 'INVALID_STORE_IMAGE_CONTENT', 'เนื้อหาไฟล์ไม่ตรงกับชนิดรูปภาพ');
      }
      for (const image of existing.filter(image => removed.has(Number(image.id)))) {
        await connection.query('DELETE FROM store_photo WHERE photo_id = ? AND store_id = ?', [image.id, storeId]);
        if (image.file_url.startsWith('/uploads/store-images/')) {
          retiredPaths.push(path.join(storeImageDirectory, path.basename(image.file_url)));
        }
      }
      const newIds: number[] = [];
      if (uploads.length) await fs.mkdir(storeImageDirectory, { recursive: true });
      for (const upload of uploads) {
        const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[upload.mimetype];
        const filename = `${crypto.randomUUID()}${extension}`;
        const diskPath = path.join(storeImageDirectory, filename);
        createdPaths.push(diskPath);
        await fs.writeFile(diskPath, upload.buffer, { flag: 'wx' });
        const [media] = await connection.query<ResultSetHeader>(
          `INSERT INTO store_photo (store_id, file_url)
           VALUES (?, ?)`,
          [storeId, `/uploads/store-images/${filename}`],
        );
        newIds.push(media.insertId);
      }
      const coverId = changes.newCoverIndex !== undefined ? newIds[changes.newCoverIndex]
        : changes.coverImageId ?? Number(remaining.find(image => image.is_cover)?.id || remaining[0]?.id || newIds[0] || 0);
      await connection.query('UPDATE store_photo SET is_cover = (photo_id = ?) WHERE store_id = ?', [coverId, storeId]);
      retiredPaths.push(...await MenuFileService.applyChanges(
        connection, storeId, menuUploads, changes.removedMenuFileIds, createdPaths,
      ));
      const databaseStatus: DatabaseStoreStatus = input.serviceStatus === 'OPEN' ? 'OPEN' : 'CLOSED';
      await connection.query(
        `UPDATE stores
         SET store_name = ?, description = ?, phone = ?, line_contact = ?, address = ?,
             google_map_url = ?, status = CASE WHEN status IN ('OPEN', 'CLOSED') THEN ? ELSE status END
         WHERE store_id = ? AND owner_user_id = ?`,
        [input.name, input.description, input.phone, input.lineUrl,
          `${input.addressLine}\nจังหวัด:${input.province}`, input.googleMapUrl, databaseStatus, storeId, userId],
      );
      const updated = {
        ...this.ownedView(await this.lockOwned(connection, userId, storeId)),
        ...((await StoreOperationsService.read(connection, [storeId])).get(storeId)),
        images: this.imageView(await this.images(connection, storeId)),
        menuFiles: await MenuFileService.read(connection, storeId),
      };
      await connection.commit();
      await Promise.all(retiredPaths.map(diskPath => fs.unlink(diskPath).catch(() => undefined)));
      return updated;
    } catch (error) {
      await connection.rollback();
      await Promise.all(createdPaths.map(diskPath => fs.unlink(diskPath).catch(() => undefined)));
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new AppError(409, 'DUPLICATE_STORE', 'มีร้านชื่อ เบอร์โทร และที่อยู่นี้อยู่แล้วในบัญชีของคุณ');
      }
      throw error;
    } finally { connection.release(); }
  }

  static async deleteOwned(userId: number, storeId: number): Promise<void> {
    const connection = await db.getConnection();
    const retiredPaths: string[] = [];
    try {
      await connection.beginTransaction();
      const before = await this.lockOwned(connection, userId, storeId);
      const [bookings] = await connection.query<RowDataPacket[]>('SELECT booking_id FROM booking WHERE store_id = ? LIMIT 1', [storeId]);
      if (bookings.length) throw new AppError(409, 'STORE_HAS_BOOKINGS', 'ร้านนี้มีประวัติการจอง กรุณาปิดให้บริการแทนการลบ เพื่อเก็บข้อมูลการจอง');
      const [storedFiles] = await connection.query<(RowDataPacket & { file_url: string })[]>(
        `SELECT file_url FROM store_photo WHERE store_id = ?
         UNION
         SELECT file_url FROM store_menu_files WHERE store_id = ?`,
        [storeId, storeId],
      );
      await connection.query(
        'DELETE FROM stores WHERE store_id = ? AND owner_user_id = ?',
        [storeId, userId],
      );
      await connection.query(
        `UPDATE users u
         SET u.role = 'member'
         WHERE u.user_id = ? AND u.role = 'owner'
           AND NOT EXISTS (
             SELECT 1 FROM stores s
             WHERE s.owner_user_id = u.user_id
               AND s.status IN ('OPEN', 'CLOSED')
           )`,
        [userId],
      );
      await connection.commit();
      for (const file of storedFiles) {
        if (file.file_url.startsWith('/uploads/store-images/')) retiredPaths.push(path.join(storeImageDirectory, path.basename(file.file_url)));
        if (file.file_url.startsWith('/uploads/menu-files/')) retiredPaths.push(path.join(path.resolve(__dirname, '../../uploads/menu-files'), path.basename(file.file_url)));
      }
      if (before.business_license_url) {
        retiredPaths.push(path.join(path.resolve(__dirname, '../../private-uploads/owner-documents'), path.basename(before.business_license_url)));
      }
      if (before.layout_image_url?.startsWith('/uploads/store-layouts/')) {
        retiredPaths.push(path.join(path.resolve(__dirname, '../../uploads/store-layouts'), path.basename(before.layout_image_url)));
      }
      await Promise.all(retiredPaths.map(filePath => fs.unlink(filePath).catch(() => undefined)));
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  static async listApproved(search: StoreSearch = {}): Promise<StoreSummary[]> {
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    const contains = (value: string) => `%${value.replace(/[!%_]/g, character => `!${character}`)}%`;
    if (search.name?.trim()) {
      conditions.push("store_name LIKE ? ESCAPE '!'");
      values.push(contains(search.name.trim()));
    }
    if (search.categoryId) {
      conditions.push('category_id = ?');
      values.push(search.categoryId);
    }
    if (search.location?.trim()) {
      conditions.push(`${provinceSelect} = ?`);
      values.push(search.location.trim());
    }
    const [rows] = await db.query<OwnedStoreSummaryRow[]>(
      `SELECT ${storeSelect}
       FROM stores
       WHERE approval_status = 'APPROVED' AND status IN ('OPEN', 'CLOSED')
         ${conditions.length ? `AND ${conditions.join(' AND ')}` : ''}
       ORDER BY created_at DESC, store_id DESC`,
      values,
    );

    const operations = await StoreOperationsService.read(db, rows.map(row => Number(row.id)));
    return rows.map((row) => ({
      ...operations.get(Number(row.id)),
      id: Number(row.id),
      name: row.name,
      description: row.description,
      province: row.province,
      googleMapUrl: row.google_map_url,
      serviceStatus: row.service_status,
      coverImageUrl: row.cover_image_url || null,
    }));
  }

  static async getApproved(storeId: number): Promise<PublicStoreDetail> {
    const [rows] = await db.query<OwnedStoreSummaryRow[]>(
      `SELECT ${storeSelect}
       FROM stores
       WHERE store_id = ? AND approval_status = 'APPROVED' AND status IN ('OPEN', 'CLOSED')
       LIMIT 1`,
      [storeId],
    );
    const row = rows[0];
    if (!row) throw new AppError(404, 'STORE_NOT_FOUND', 'ไม่พบร้านค้า');
    return {
      id: Number(row.id), name: row.name, description: row.description, phone: row.phone,
      lineUrl: row.line_url, addressLine: row.address_line, province: row.province,
      googleMapUrl: row.google_map_url, serviceStatus: row.service_status,
      coverImageUrl: row.cover_image_url || null,
      ...((await StoreOperationsService.read(db, [storeId])).get(storeId)),
      images: this.imageView(await this.images(db, storeId)),
      menuFiles: await MenuFileService.read(db, storeId),
      layout: await this.publicLayout(storeId, row.layout_image_url),
    };
  }

  static async listApprovedLocations(): Promise<StoreLocation[]> {
    const [rows] = await db.query<(RowDataPacket & { province: string })[]>(
      `SELECT DISTINCT ${provinceSelect} AS province
       FROM stores
       WHERE approval_status = 'APPROVED' AND status IN ('OPEN', 'CLOSED') AND ${provinceSelect} <> ''
       ORDER BY province`,
    );
    return rows.map(row => ({
      label: row.province,
      value: row.province,
    }));
  }

  static async listOwnedByUser(userId: number): Promise<OwnedStoreSummary[]> {
    const [rows] = await db.query<OwnedStoreSummaryRow[]>(
      `SELECT ${storeSelect}
       FROM stores
       WHERE owner_user_id = ?
       ORDER BY created_at DESC, store_id DESC`,
      [userId],
    );

    const operations = await StoreOperationsService.read(db, rows.map(row => Number(row.id)));
    return rows.map(row => ({ ...this.ownedView(row), ...operations.get(Number(row.id)) }));
  }
}
