import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error';

export const profileImageDirectory = path.resolve(__dirname, '../../uploads/profile-images');
fs.mkdirSync(profileImageDirectory, { recursive: true });

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const extensionByMimeType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: profileImageDirectory,
    filename: (_req, file, callback) => {
      const extension = extensionByMimeType[file.mimetype] || '';
      callback(null, `profile-${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError(422, 'INVALID_PROFILE_IMAGE', 'รองรับเฉพาะรูป JPG, PNG และ WebP'));
      return;
    }
    callback(null, true);
  },
});

export const uploadProfileImage = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('profileImage')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(422, 'PROFILE_IMAGE_TOO_LARGE', 'รูปโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB'));
      return;
    }

    next(error);
  });
};
