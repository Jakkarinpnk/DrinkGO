import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `ไม่พบเส้นทาง ${req.method} ${req.originalUrl}`,
    },
  });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    message: 'เกิดข้อผิดพลาดภายในระบบ',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'เกิดข้อผิดพลาดภายในระบบ',
    },
  });
};
