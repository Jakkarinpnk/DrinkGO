import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { AppError } from '../errors/app-error';

type DatabaseClient = Pool | PoolConnection;

interface MenuFileRow extends RowDataPacket {
  id: number;
  file_url: string;
}

export interface MenuFileView {
  id: number;
  url: string;
}

export const menuFileDirectory = path.resolve(__dirname, '../../uploads/menu-files');
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const verifyContent = (file: Express.Multer.File): void => {
  if (!allowedTypes.has(file.mimetype)) {
    throw new AppError(422, 'INVALID_MENU_FILE', 'ไฟล์เมนูรองรับเฉพาะ PDF, JPG, PNG และ WebP');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new AppError(422, 'MENU_FILE_TOO_LARGE', 'ไฟล์เมนูแต่ละไฟล์ต้องมีขนาดไม่เกิน 10 MB');
  }
  const buffer = file.buffer;
  const valid =
    (file.mimetype === 'application/pdf' && buffer.subarray(0, 5).toString() === '%PDF-') ||
    (file.mimetype === 'image/png' && buffer.length >= 33 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      buffer.subarray(12, 16).toString() === 'IHDR') ||
    (file.mimetype === 'image/jpeg' && buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 &&
      buffer[buffer.length - 2] === 255 && buffer[buffer.length - 1] === 217) ||
    (file.mimetype === 'image/webp' && buffer.length >= 16 && buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP' && buffer.readUInt32LE(4) === buffer.length - 8);
  if (!valid) throw new AppError(422, 'INVALID_MENU_FILE_CONTENT', 'เนื้อหาไฟล์เมนูไม่ตรงกับชนิดไฟล์');
};

export class MenuFileService {
  static verify(files: Express.Multer.File[]): void {
    if (files.length > 10) throw new AppError(422, 'TOO_MANY_MENU_FILES', 'ร้านมีไฟล์เมนูได้ไม่เกิน 10 ไฟล์');
    files.forEach(verifyContent);
  }

  static async read(client: DatabaseClient, storeId: number): Promise<MenuFileView[]> {
    const [rows] = await client.query<MenuFileRow[]>(
      `SELECT menu_file_id AS id, file_url
       FROM store_menu_files
       WHERE store_id = ?
       ORDER BY menu_file_id`,
      [storeId],
    );
    return rows.map(row => ({ id: Number(row.id), url: row.file_url }));
  }

  static async add(
    connection: PoolConnection,
    storeId: number,
    files: Express.Multer.File[],
    createdPaths: string[],
  ): Promise<void> {
    this.verify(files);
    if (!files.length) return;
    await fs.mkdir(menuFileDirectory, { recursive: true });
    for (const file of files) {
      const extension = {
        'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
      }[file.mimetype];
      const filename = `${crypto.randomUUID()}${extension}`;
      const diskPath = path.join(menuFileDirectory, filename);
      await fs.writeFile(diskPath, file.buffer, { flag: 'wx' });
      createdPaths.push(diskPath);
      await connection.query(
        `INSERT INTO store_menu_files (store_id, file_url)
         VALUES (?, ?)`,
        [storeId, `/uploads/menu-files/${filename}`],
      );
    }
  }

  static async applyChanges(
    connection: PoolConnection,
    storeId: number,
    uploads: Express.Multer.File[],
    removedIds: number[],
    createdPaths: string[],
  ): Promise<string[]> {
    this.verify(uploads);
    const [existing] = await connection.query<MenuFileRow[]>(
      `SELECT menu_file_id AS id, file_url
       FROM store_menu_files
       WHERE store_id = ? FOR UPDATE`,
      [storeId],
    );
    const removed = new Set(removedIds);
    if ([...removed].some(id => !existing.some(file => Number(file.id) === id))) {
      throw new AppError(422, 'INVALID_MENU_FILE_ID', 'ไม่พบไฟล์เมนูที่ต้องการนำออกจากร้านนี้');
    }
    const remaining = existing.filter(file => !removed.has(Number(file.id)));
    if (remaining.length + uploads.length > 10) {
      throw new AppError(422, 'TOO_MANY_MENU_FILES', 'ร้านมีไฟล์เมนูได้ไม่เกิน 10 ไฟล์');
    }
    const retiredPaths: string[] = [];
    for (const file of existing.filter(item => removed.has(Number(item.id)))) {
      await connection.query('DELETE FROM store_menu_files WHERE menu_file_id = ? AND store_id = ?', [file.id, storeId]);
      if (file.file_url.startsWith('/uploads/menu-files/')) {
        retiredPaths.push(path.join(menuFileDirectory, path.basename(file.file_url)));
      }
    }
    await this.add(connection, storeId, uploads, createdPaths);
    return retiredPaths;
  }
}
