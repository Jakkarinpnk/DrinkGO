import fs from 'fs/promises';
import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';

export const validateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const result = validationResult(req);
  if (result.isEmpty()) {
    next();
    return;
  }

  if (req.file) {
    await fs.unlink(req.file.path).catch(() => undefined);
  }

  res.status(422).json({
    message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
    error: {
      code: 'VALIDATION_ERROR',
      message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
      fields: result.array().map((error) => ({
        field: error.type === 'field' ? error.path : undefined,
        message: error.msg,
      })),
    },
  });
};
