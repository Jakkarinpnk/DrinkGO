import { NextFunction, Response } from 'express';
import { LayoutTablePositionInput, StoreLayoutService } from '../services/store-layout.service';
import { AuthRequest } from '../types';

export const getOwnedStoreLayoutController = async (
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const layout = await StoreLayoutService.getOwned(req.user!.id, Number(req.params.storeId));
    res.status(200).json({ message: 'ดึงข้อมูล Layout สำเร็จ', data: layout });
  } catch (error) { next(error); }
};

export const saveOwnedStoreLayoutImageController = async (
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const layout = await StoreLayoutService.saveImage(req.user!.id, Number(req.params.storeId), req.file);
    res.status(200).json({ message: 'บันทึกรูป Layout สำเร็จ', data: layout });
  } catch (error) { next(error); }
};

export const deleteOwnedStoreLayoutImageController = async (
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const layout = await StoreLayoutService.deleteImage(req.user!.id, Number(req.params.storeId));
    res.status(200).json({ message: 'ลบรูป Layout สำเร็จ', data: layout });
  } catch (error) { next(error); }
};

export const saveOwnedStoreLayoutTablesController = async (
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const layout = await StoreLayoutService.saveTables(
      req.user!.id,
      Number(req.params.storeId),
      req.body.tables as LayoutTablePositionInput[],
    );
    res.status(200).json({ message: 'บันทึกตำแหน่งและสถานะโต๊ะสำเร็จ', data: layout });
  } catch (error) { next(error); }
};
