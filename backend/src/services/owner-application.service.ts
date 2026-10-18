import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { db } from '../config/db';
import { AppError } from '../errors/app-error';
import { businessDocumentDirectory } from '../middlewares/business-document.middleware';
import { Role } from '../types';
import { StoreOperations, StoreOperationsInput, StoreOperationsService } from './store-operations.service';
import { storeImageDirectory } from './store.service';
import { MenuFileService, MenuFileView } from './menu-file.service';

export type OwnerApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type BusinessDocumentType = 'COMMERCIAL_REGISTRATION' | 'OTHER';

export interface OwnerApplicationInput extends StoreOperationsInput {
  storeName: string;
  description: string | null;
  storePhone: string;
  lineUrl: string;
  addressLine: string;
  province: string;
  googleMapUrl: string;
  documentType: BusinessDocumentType;
}

export interface OwnerApplicationView {
  id: number;
  status: OwnerApplicationStatus;
  applicant: {
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
    role: Role;
  };
  store: Partial<StoreOperations> & {
    id: number;
    name: string;
    description: string | null;
    phone: string;
    lineUrl: string;
    addressLine: string;
    province: string;
    googleMapUrl: string;
    coverImageUrl: string | null;
    images: { id: number; url: string; altText: string | null; isCover: boolean }[];
    menuFiles: MenuFileView[];
  };
  document: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    documentType: BusinessDocumentType;
  };
}

interface ApplicationRow extends RowDataPacket {
  id: number;
  status: OwnerApplicationStatus;
  applicant_user_id: number;
  applicant_full_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  applicant_role: Role;
  store_id: number;
  store_name: string;
  store_description: string | null;
  store_phone: string;
  line_url: string;
  address_line: string;
  province: string;
  google_map_url: string;
  original_name: string;
  mime_type: string;
  size_bytes: string | number;
  document_type: BusinessDocumentType;
}

interface ReviewRow extends RowDataPacket {
  id: number;
  applicant_user_id: number;
  status: OwnerApplicationStatus;
  applicant_role: Role;
}

interface DocumentRow extends RowDataPacket {
  storage_key: string;
  original_name: string;
}

interface StoreImageRow extends RowDataPacket {
  id: number;
  store_id: number;
  file_url: string;
  is_cover: number;
}

type DatabaseClient = Pool | PoolConnection;

const applicationSelect = `
  SELECT
    s.store_id AS id,
    s.approval_status AS status,
    u.user_id AS applicant_user_id,
    u.full_name AS applicant_full_name,
    u.email AS applicant_email,
    u.phone_number AS applicant_phone,
    u.role AS applicant_role,
    s.store_id,
    s.store_name,
    s.description AS store_description,
    s.phone AS store_phone,
    s.line_contact AS line_url,
    SUBSTRING_INDEX(s.address, '\nจังหวัด:', 1) AS address_line,
    TRIM(SUBSTRING_INDEX(s.address, '\nจังหวัด:', -1)) AS province,
    s.google_map_url,
    SUBSTRING_INDEX(s.business_license_url, '/', -1) AS original_name,
    CASE
      WHEN LOWER(s.business_license_url) LIKE '%.pdf' THEN 'application/pdf'
      WHEN LOWER(s.business_license_url) LIKE '%.png' THEN 'image/png'
      ELSE 'image/jpeg'
    END AS mime_type,
    0 AS size_bytes,
    'COMMERCIAL_REGISTRATION' AS document_type
  FROM stores s
  INNER JOIN users u ON u.user_id = s.owner_user_id
`;

const applicationView = (row: ApplicationRow): OwnerApplicationView => ({
  id: row.id,
  status: row.status,
  applicant: {
    id: row.applicant_user_id,
    fullName: row.applicant_full_name,
    email: row.applicant_email,
    phone: row.applicant_phone,
    role: row.applicant_role,
  },
  store: {
    id: row.store_id,
    name: row.store_name,
    description: row.store_description,
    phone: row.store_phone,
    lineUrl: row.line_url,
    addressLine: row.address_line,
    province: row.province,
    googleMapUrl: row.google_map_url,
    coverImageUrl: null,
    images: [],
    menuFiles: [],
  },
  document: {
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    documentType: row.document_type,
  },
});

const verifyDocumentSignature = (file: Express.Multer.File): void => {
  const signature = file.buffer.subarray(0, 8);
  const valid =
    (file.mimetype === 'application/pdf' && signature.subarray(0, 5).toString() === '%PDF-') ||
    (file.mimetype === 'image/png' && signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (file.mimetype === 'image/jpeg' &&
      signature[0] === 0xff &&
      signature[1] === 0xd8 &&
      signature[2] === 0xff);

  if (!valid) {
    throw new AppError(422, 'INVALID_DOCUMENT_CONTENT', 'เนื้อหาไฟล์เอกสารไม่ตรงกับชนิดไฟล์');
  }
};

const verifyStoreImage = (file: Express.Multer.File): void => {
  if (file.size > 5 * 1024 * 1024) {
    throw new AppError(422, 'STORE_IMAGE_TOO_LARGE', 'แต่ละรูปต้องมีขนาดไม่เกิน 5 MB');
  }
  const buffer = file.buffer;
  const valid =
    (file.mimetype === 'image/png' && buffer.length >= 33 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      buffer.subarray(12, 16).toString() === 'IHDR') ||
    (file.mimetype === 'image/jpeg' && buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 &&
      buffer[buffer.length - 2] === 255 && buffer[buffer.length - 1] === 217) ||
    (file.mimetype === 'image/webp' && buffer.length >= 16 && buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP' && buffer.readUInt32LE(4) === buffer.length - 8);
  if (!valid) throw new AppError(422, 'INVALID_STORE_IMAGE_CONTENT', 'เนื้อหาไฟล์ไม่ตรงกับชนิดรูปภาพ');
};

export class OwnerApplicationService {
  private static async attachImages(client: DatabaseClient, views: OwnerApplicationView[]): Promise<void> {
    const storeIds = views.map(view => Number(view.store.id));
    if (!storeIds.length) return;
    const [rows] = await client.query<StoreImageRow[]>(
      `SELECT photo_id AS id, store_id, file_url, is_cover
       FROM store_photo
       WHERE store_id IN (?)
       ORDER BY store_id, photo_id`,
      [storeIds],
    );
    for (const view of views) {
      view.store.images = rows.filter(row => Number(row.store_id) === Number(view.store.id)).map(row => ({
        id: Number(row.id),
        url: row.file_url,
        altText: null,
        isCover: Boolean(row.is_cover),
      }));
      view.store.coverImageUrl = view.store.images.find(image => image.isCover)?.url || view.store.images[0]?.url || null;
      view.store.menuFiles = await MenuFileService.read(client, Number(view.store.id));
    }
  }

  private static async findById(
    client: DatabaseClient,
    storeId: number,
  ): Promise<OwnerApplicationView | null> {
    const [rows] = await client.query<ApplicationRow[]>(
      `${applicationSelect} WHERE s.store_id = ? LIMIT 1`,
      [storeId],
    );
    if (!rows[0]) return null;
    const view = applicationView(rows[0]);
    Object.assign(view.store, (await StoreOperationsService.read(client, [Number(view.store.id)])).get(Number(view.store.id)));
    await this.attachImages(client, [view]);
    return view;
  }

  static async submit(
    userId: number,
    input: OwnerApplicationInput,
    document: Express.Multer.File,
    images: Express.Multer.File[] = [],
    menuFiles: Express.Multer.File[] = [],
    newCoverIndex?: number,
  ): Promise<OwnerApplicationView> {
    verifyDocumentSignature(document);
    if (images.length > 10) throw new AppError(422, 'TOO_MANY_STORE_IMAGES', 'ร้านมีรูปภาพได้ไม่เกิน 10 รูป');
    images.forEach(verifyStoreImage);
    MenuFileService.verify(menuFiles);
    if (newCoverIndex !== undefined && (!Number.isInteger(newCoverIndex) || newCoverIndex < 0 || newCoverIndex >= images.length)) {
      throw new AppError(422, 'INVALID_STORE_COVER', 'กรุณาเลือกรูปปกที่อัปโหลด');
    }
    const submissionKey = [input.storeName, input.storePhone, input.addressLine]
      .map(value => value.trim().toLocaleLowerCase('th-TH')).join('|');
    const documentExtension = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' }[document.mimetype];
    const documentFilename = `business-${Date.now()}-${crypto.randomUUID()}${documentExtension}`;
    const documentPath = path.join(businessDocumentDirectory, documentFilename);
    const createdPaths: string[] = [];
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [users] = await connection.query<(RowDataPacket & { role: Role })[]>(
        'SELECT role FROM users WHERE user_id = ? FOR UPDATE',
        [userId],
      );
      if (!users[0]) {
        throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบบัญชีผู้ใช้');
      }
      if (users[0].role !== 'member' && users[0].role !== 'owner') {
        throw new AppError(409, 'OWNER_APPLICATION_NOT_ALLOWED', 'บัญชีนี้ไม่สามารถลงทะเบียนร้านได้');
      }

      const [existing] = await connection.query<(RowDataPacket & { store_name: string; phone: string; address: string })[]>(
        `SELECT store_name, phone, address FROM stores
         WHERE owner_user_id = ? AND approval_status IN ('PENDING', 'APPROVED') FOR UPDATE`, [userId],
      );
      if (existing.some(store => [store.store_name, store.phone, store.address.split('\nจังหวัด:')[0]]
        .map(value => value.trim().toLocaleLowerCase('th-TH')).join('|') === submissionKey)) {
        throw new AppError(409, 'OWNER_APPLICATION_EXISTS', 'ร้านนี้มีคำขอที่กำลังตรวจสอบหรืออนุมัติแล้ว');
      }

      const firstHours = input.hours.find(hour => !hour.isClosed);
      if (!firstHours?.openTime || !firstHours.closeTime) {
        throw new AppError(422, 'INVALID_STORE_HOURS', 'กรุณาเลือกวันเปิดร้านและระบุเวลาเปิด–ปิดร้าน');
      }
      const openDaysMask = input.hours.reduce((mask, hour) => hour.isClosed ? mask : mask | (1 << hour.dayOfWeek), 0);
      const storageKey = `owner-documents/${documentFilename}`;
      const [storeResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO stores
          (owner_user_id, category_id, store_name, line_contact, phone, address,
           google_map_url, description, open_time, close_time, open_days_mask, business_license_url, status, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING')`,
        [
          userId,
          input.categoryId,
          input.storeName,
          input.lineUrl,
          input.storePhone,
          `${input.addressLine}\nจังหวัด:${input.province}`,
          input.googleMapUrl,
          input.description,
          firstHours.openTime,
          firstHours.closeTime,
          openDaysMask,
          storageKey,
        ],
      );

      await fs.mkdir(businessDocumentDirectory, { recursive: true });
      await fs.writeFile(documentPath, document.buffer, { flag: 'wx' });
      createdPaths.push(documentPath);
      await StoreOperationsService.save(connection, storeResult.insertId, input);

      const imageMediaIds: number[] = [];
      if (images.length) await fs.mkdir(storeImageDirectory, { recursive: true });
      for (const image of images) {
        const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[image.mimetype];
        const filename = `${crypto.randomUUID()}${extension}`;
        const diskPath = path.join(storeImageDirectory, filename);
        await fs.writeFile(diskPath, image.buffer, { flag: 'wx' });
        createdPaths.push(diskPath);
        const [media] = await connection.query<ResultSetHeader>(
          `INSERT INTO store_photo (store_id, file_url)
           VALUES (?, ?)`,
          [storeResult.insertId, `/uploads/store-images/${filename}`],
        );
        imageMediaIds.push(media.insertId);
      }
      if (imageMediaIds.length) {
        const coverId = imageMediaIds[newCoverIndex ?? 0];
        await connection.query('UPDATE store_photo SET is_cover = (photo_id = ?) WHERE store_id = ?', [coverId, storeResult.insertId]);
      }
      await MenuFileService.add(connection, storeResult.insertId, menuFiles, createdPaths);

      const application = await this.findById(connection, storeResult.insertId);
      if (!application) {
        throw new Error('Created owner application could not be loaded');
      }
      await connection.commit();
      return application;
    } catch (error) {
      await connection.rollback();
      await Promise.all(createdPaths.map(createdPath => fs.unlink(createdPath).catch(() => undefined)));
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new AppError(409, 'OWNER_APPLICATION_EXISTS', 'ร้านนี้มีคำขอที่กำลังตรวจสอบหรืออนุมัติแล้ว');
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getCurrent(userId: number): Promise<OwnerApplicationView | null> {
    const [rows] = await db.query<ApplicationRow[]>(
      `${applicationSelect}
       WHERE s.owner_user_id = ?
       ORDER BY s.created_at DESC, s.store_id DESC
       LIMIT 1`,
      [userId],
    );
    if (!rows[0]) return null;
    const view = applicationView(rows[0]);
    Object.assign(view.store, (await StoreOperationsService.read(db, [Number(view.store.id)])).get(Number(view.store.id)));
    await this.attachImages(db, [view]);
    return view;
  }

  static async list(status?: OwnerApplicationStatus): Promise<OwnerApplicationView[]> {
    const parameters: unknown[] = [];
    const where = status ? 'WHERE s.approval_status = ?' : '';
    if (status) parameters.push(status);
    const [rows] = await db.query<ApplicationRow[]>(
      `${applicationSelect} ${where} ORDER BY s.created_at DESC, s.store_id DESC`,
      parameters,
    );
    const operations = await StoreOperationsService.read(db, rows.map(row => Number(row.store_id)));
    const views = rows.map(row => { const view = applicationView(row); Object.assign(view.store, operations.get(Number(row.store_id))); return view; });
    await this.attachImages(db, views);
    return views;
  }

  static async review(
    storeId: number,
    status: Exclude<OwnerApplicationStatus, 'PENDING'>,
  ): Promise<OwnerApplicationView> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<ReviewRow[]>(
        `SELECT s.store_id AS id, s.owner_user_id AS applicant_user_id,
                s.approval_status AS status, u.role AS applicant_role
         FROM stores s
         INNER JOIN users u ON u.user_id = s.owner_user_id
         WHERE s.store_id = ?
         FOR UPDATE`,
        [storeId],
      );
      const application = rows[0];
      if (!application) {
        throw new AppError(404, 'OWNER_APPLICATION_NOT_FOUND', 'ไม่พบคำขอ');
      }
      if (application.status !== 'PENDING') {
        throw new AppError(409, 'OWNER_APPLICATION_ALREADY_REVIEWED', 'คำขอนี้ถูกตรวจสอบแล้ว');
      }
      if (status === 'APPROVED' && !['member', 'owner'].includes(application.applicant_role)) {
        throw new AppError(409, 'APPLICANT_ROLE_CHANGED', 'สถานะสมาชิกของผู้สมัครเปลี่ยนไปแล้ว');
      }

      await connection.query(
        `UPDATE stores
         SET approval_status = ?, status = ?
         WHERE store_id = ?`,
        [status, status === 'APPROVED' ? 'OPEN' : 'REJECTED', storeId],
      );

      if (status === 'APPROVED') {
        await connection.query(
          `UPDATE users SET role = 'owner' WHERE user_id = ?`,
          [application.applicant_user_id],
        );
      }

      const reviewed = await this.findById(connection, storeId);
      if (!reviewed) throw new Error('Reviewed owner application could not be loaded');
      await connection.commit();
      return reviewed;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getDocument(storeId: number): Promise<{ path: string; name: string }> {
    const [rows] = await db.query<DocumentRow[]>(
      `SELECT s.business_license_url AS storage_key,
              SUBSTRING_INDEX(s.business_license_url, '/', -1) AS original_name
       FROM stores s
       WHERE s.store_id = ?
       LIMIT 1`,
      [storeId],
    );
    if (!rows[0]) {
      throw new AppError(404, 'OWNER_APPLICATION_DOCUMENT_NOT_FOUND', 'ไม่พบเอกสารคำขอ');
    }

    const documentPath = path.resolve(businessDocumentDirectory, path.basename(rows[0].storage_key));
    if (!documentPath.startsWith(`${businessDocumentDirectory}${path.sep}`)) {
      throw new AppError(500, 'INVALID_DOCUMENT_PATH', 'ตำแหน่งไฟล์เอกสารไม่ถูกต้อง');
    }
    await fs.access(documentPath).catch(() => {
      throw new AppError(404, 'OWNER_APPLICATION_DOCUMENT_NOT_FOUND', 'ไม่พบไฟล์เอกสาร');
    });
    return { path: documentPath, name: rows[0].original_name };
  }
}
