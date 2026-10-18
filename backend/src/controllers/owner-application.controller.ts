import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types';
import {
  BusinessDocumentType,
  OwnerApplicationService,
  OwnerApplicationStatus,
} from '../services/owner-application.service';
import { AppError } from '../errors/app-error';

export const submitOwnerApplicationController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const files = req.files as { businessDocument?: Express.Multer.File[]; images?: Express.Multer.File[]; menuFiles?: Express.Multer.File[] } | undefined;
    const document = files?.businessDocument?.[0];
    const images = files?.images || [];
    if (!document) {
      throw new AppError(422, 'BUSINESS_DOCUMENT_REQUIRED', 'กรุณาแนบเอกสารยืนยันธุรกิจ');
    }
    const application = await OwnerApplicationService.submit(
      req.user!.id,
      {
        storeName: req.body.storeName,
        description: req.body.description || null,
        storePhone: req.body.storePhone,
        lineUrl: req.body.lineUrl,
        addressLine: req.body.addressLine,
        province: req.body.province,
        googleMapUrl: req.body.googleMapUrl,
        documentType: req.body.documentType as BusinessDocumentType,
        categoryId: req.body.categoryId, hours: req.body.hours,
      },
      document,
      images,
      files?.menuFiles || [],
      req.body.newCoverIndex === undefined ? undefined : Number(req.body.newCoverIndex),
    );
    res.status(201).json({ message: 'ส่งคำขอเป็นเจ้าของร้านสำเร็จ', data: application });
  } catch (error) {
    next(error);
  }
};

export const getOwnerApplicationStatusController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const application = await OwnerApplicationService.getCurrent(req.user!.id);
    res.status(200).json({ message: 'ดึงสถานะคำขอสำเร็จ', data: application });
  } catch (error) {
    next(error);
  }
};

export const listOwnerApplicationsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const status = req.query.status as OwnerApplicationStatus | undefined;
    const applications = await OwnerApplicationService.list(status);
    res.status(200).json({ message: 'ดึงรายการคำขอสำเร็จ', data: applications });
  } catch (error) {
    next(error);
  }
};

export const reviewOwnerApplicationController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const application = await OwnerApplicationService.review(
      Number(req.params.id),
      req.body.status,
    );
    res.status(200).json({
      message: req.body.status === 'APPROVED' ? 'อนุมัติคำขอสำเร็จ' : 'ปฏิเสธคำขอสำเร็จ',
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadOwnerApplicationDocumentController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const document = await OwnerApplicationService.getDocument(Number(req.params.id));
    res.download(document.path, document.name, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};
