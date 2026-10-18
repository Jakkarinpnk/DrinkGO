import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error';

export const businessDocumentDirectory = path.resolve(
  __dirname,
  '../../private-uploads/owner-documents',
);
fs.mkdirSync(businessDocumentDirectory, { recursive: true });

const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 21, fields: 24, fieldSize: 8192 },
  fileFilter: (_req, file, callback) => {
    if (file.fieldname === 'businessDocument' && !allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError(422, 'INVALID_BUSINESS_DOCUMENT', 'รองรับเฉพาะไฟล์ PDF, JPG และ PNG'));
      return;
    }
    if (file.fieldname === 'images' && !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new AppError(422, 'INVALID_STORE_IMAGE', 'รองรับเฉพาะรูป JPG, PNG และ WebP'));
      return;
    }
    if (file.fieldname === 'menuFiles' && !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new AppError(422, 'INVALID_MENU_FILE', 'ไฟล์เมนูรองรับเฉพาะ PDF, JPG, PNG และ WebP'));
      return;
    }
    if (!['businessDocument', 'images', 'menuFiles'].includes(file.fieldname)) {
      callback(new AppError(422, 'INVALID_UPLOAD_FIELD', 'ช่องอัปโหลดไฟล์ไม่ถูกต้อง'));
      return;
    }
    callback(null, true);
  },
});

export const uploadBusinessDocument = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  upload.fields([
    { name: 'businessDocument', maxCount: 1 },
    { name: 'images', maxCount: 10 },
    { name: 'menuFiles', maxCount: 10 },
  ])(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      next(new AppError(422, 'INVALID_OWNER_APPLICATION_UPLOAD', error.code === 'LIMIT_FILE_SIZE'
        ? 'เอกสารและไฟล์เมนูต้องไม่เกิน 10 MB ส่วนรูปภาพร้านต้องไม่เกิน 5 MB ต่อไฟล์'
        : 'แนบเอกสารได้ 1 ไฟล์ รูปภาพร้าน 10 รูป และไฟล์เมนู 10 ไฟล์'));
      return;
    }

    next(error);
  });
};
