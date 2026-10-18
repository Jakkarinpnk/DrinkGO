import { NextFunction, Request, Response } from 'express';
import { StoreService } from '../services/store.service';
import { AuthRequest } from '../types';

export const listApprovedStoresController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const stores = await StoreService.listApproved({
      name: req.query.name as string | undefined,
      location: req.query.location as string | undefined,
      categoryId: req.query.categoryId === undefined ? undefined : Number(req.query.categoryId),
    });
    res.status(200).json({ message: 'ดึงรายการร้านค้าสำเร็จ', data: stores });
  } catch (error) {
    next(error);
  }
};

export const listStoreLocationsController = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ message: 'ดึงสถานที่ร้านค้าสำเร็จ', data: await StoreService.listApprovedLocations() });
  } catch (error) { next(error); }
};

export const getApprovedStoreController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ message: 'ดึงรายละเอียดร้านสำเร็จ', data: await StoreService.getApproved(Number(req.params.id)) });
  } catch (error) { next(error); }
};

export const listOwnedStoresController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const stores = await StoreService.listOwnedByUser(req.user!.id);
    res.status(200).json({ message: 'ดึงรายการร้านของคุณสำเร็จ', data: stores });
  } catch (error) {
    next(error);
  }
};

export const updateOwnedStoreController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, phone, lineUrl, addressLine, province, googleMapUrl, serviceStatus } = req.body;
    const files = req.files as { images?: Express.Multer.File[]; menuFiles?: Express.Multer.File[] } | undefined;
    const store = await StoreService.updateOwned(req.user!.id, Number(req.params.id), {
      name, description: description || null, phone, lineUrl, addressLine,
      province, googleMapUrl, serviceStatus,
      categoryId: req.body.categoryId, hours: req.body.hours,
    }, files?.images || [], files?.menuFiles || [], {
      removedImageIds: req.body.removedImageIds || [],
      removedMenuFileIds: req.body.removedMenuFileIds || [],
      coverImageId: req.body.coverImageId == null || req.body.coverImageId === '' ? undefined : Number(req.body.coverImageId),
      newCoverIndex: req.body.newCoverIndex == null || req.body.newCoverIndex === '' ? undefined : Number(req.body.newCoverIndex),
    });
    res.status(200).json({ message: 'แก้ไขข้อมูลร้านสำเร็จ', data: store });
  } catch (error) { next(error); }
};

export const getOwnedStoreController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ message: 'ดึงข้อมูลร้านสำเร็จ', data: await StoreService.getOwned(req.user!.id, Number(req.params.id)) });
  } catch (error) { next(error); }
};

export const deleteOwnedStoreController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await StoreService.deleteOwned(req.user!.id, Number(req.params.id));
    res.status(200).json({ message: 'ลบร้านสำเร็จ' });
  } catch (error) { next(error); }
};
