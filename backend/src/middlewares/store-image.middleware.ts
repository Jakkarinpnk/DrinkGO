import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 20, fields: 24, fieldSize: 8192 },
  fileFilter: (_req, file, callback) => {
    if (file.fieldname === 'images' && !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new AppError(422, 'INVALID_STORE_IMAGE', 'รองรับเฉพาะรูป JPG, PNG และ WebP'));
    } else if (file.fieldname === 'menuFiles' && !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new AppError(422, 'INVALID_MENU_FILE', 'ไฟล์เมนูรองรับเฉพาะ PDF, JPG, PNG และ WebP'));
    } else if (!['images', 'menuFiles'].includes(file.fieldname)) {
      callback(new AppError(422, 'INVALID_UPLOAD_FIELD', 'ช่องอัปโหลดไฟล์ไม่ถูกต้อง'));
    } else callback(null, true);
  },
});

export const uploadStoreImages = (req: Request, res: Response, next: NextFunction): void => {
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'menuFiles', maxCount: 10 }])(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new AppError(422, 'INVALID_STORE_FILE_UPLOAD', error.code === 'LIMIT_FILE_SIZE'
        ? 'รูปภาพร้านต้องไม่เกิน 5 MB และไฟล์เมนูต้องไม่เกิน 10 MB ต่อไฟล์'
        : 'อัปโหลดรูปภาพร้านและไฟล์เมนูได้ประเภทละไม่เกิน 10 ไฟล์'));
    } else next(error);
  });
};
