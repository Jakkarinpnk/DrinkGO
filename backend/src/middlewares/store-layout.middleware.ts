import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new AppError(422, 'INVALID_LAYOUT_IMAGE', 'รูป Layout รองรับเฉพาะ JPG, PNG และ WebP'));
      return;
    }
    callback(null, true);
  },
});

export const uploadStoreLayout = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('layout')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new AppError(422, 'INVALID_LAYOUT_UPLOAD', error.code === 'LIMIT_FILE_SIZE'
        ? 'รูป Layout ต้องมีขนาดไม่เกิน 5 MB'
        : 'อัปโหลดรูป Layout ได้ครั้งละ 1 รูป'));
    } else {
      next(error);
    }
  });
};
