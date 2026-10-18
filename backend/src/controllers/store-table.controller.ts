import { NextFunction, Response } from 'express';
import { StoreTableInput, StoreTableService } from '../services/store-table.service';
import { AuthRequest } from '../types';

const inputFrom = (req: AuthRequest): StoreTableInput => ({
  tableNumber: req.body.tableNumber,
  seatCapacity: Number(req.body.seatCapacity),
  status: req.body.status,
});

export const listOwnedStoreTablesController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const tables = await StoreTableService.listOwned(req.user!.id, Number(req.params.storeId));
    res.status(200).json({ message: 'ดึงรายการโต๊ะสำเร็จ', data: tables });
  } catch (error) {
    next(error);
  }
};

export const createOwnedStoreTableController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const table = await StoreTableService.createOwned(req.user!.id, Number(req.params.storeId), inputFrom(req));
    res.status(201).json({ message: 'เพิ่มโต๊ะสำเร็จ', data: table });
  } catch (error) {
    next(error);
  }
};

export const updateOwnedStoreTableController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const table = await StoreTableService.updateOwned(
      req.user!.id,
      Number(req.params.storeId),
      Number(req.params.tableId),
      inputFrom(req),
    );
    res.status(200).json({ message: 'แก้ไขโต๊ะสำเร็จ', data: table });
  } catch (error) {
    next(error);
  }
};

export const deleteOwnedStoreTableController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await StoreTableService.deleteOwned(req.user!.id, Number(req.params.storeId), Number(req.params.tableId));
    res.status(200).json({ message: 'ลบโต๊ะสำเร็จ' });
  } catch (error) {
    next(error);
  }
};
