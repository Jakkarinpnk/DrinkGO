import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { AuthRequest } from '../types';
import { BookingService } from '../services/booking.service';
import { isServiceDate } from '../services/booking-time';

export const bookingRoutes = Router();
const id = (name: string) => param(name).isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt();
const members = [authenticate, authorize('member', 'owner')];
const owners = [authenticate, authorize('owner')];

bookingRoutes.get('/stores/:storeId/availability', id('storeId'),
  query('date').custom(isServiceDate).withMessage('วันที่จองไม่ถูกต้อง'),
  query('peopleCount').isInt({ min: 1, max: 1000 }).toInt(), validateRequest,
  async (req, res, next) => {
    try { res.json({ data: await BookingService.availability(Number(req.params.storeId), String(req.query.date), Number(req.query.peopleCount)) }); }
    catch (error) { next(error); }
  });

bookingRoutes.post('/bookings', ...members,
  body('storeId').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('tableId').optional().isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body('tableIds').optional().isArray({ min: 1, max: 20 }),
  body('tableIds.*').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  body().custom(value => (value.tableId === undefined) !== (value.tableIds === undefined))
    .withMessage('กรุณาระบุโต๊ะที่ต้องการจอง'),
  body('serviceDate').custom(isServiceDate).withMessage('วันที่จองไม่ถูกต้อง'),
  body('arrivalTime').isString().bail().matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body('peopleCount').isInt({ min: 1, max: 1000 }).toInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const b = req.body;
      res.status(201).json({ message: 'จองโต๊ะสำเร็จ', data: await BookingService.create(req.user!.id, {
        storeId: b.storeId, tableId: b.tableId, tableIds: b.tableIds,
        serviceDate: b.serviceDate, arrivalTime: b.arrivalTime,
        peopleCount: b.peopleCount,
      }) });
    } catch (error) { next(error); }
  });
bookingRoutes.get('/bookings/mine', ...members, async (req: AuthRequest, res, next) => {
  try { res.json({ data: await BookingService.listMine(req.user!.id) }); } catch (error) { next(error); }
});
bookingRoutes.patch('/bookings/:bookingId/cancel', ...members, id('bookingId'), validateRequest,
  async (req: AuthRequest, res, next) => {
    try { res.json({ data: await BookingService.changeStatus(req.user!.id, Number(req.params.bookingId), 'CANCELLED') }); } catch (error) { next(error); }
  });
bookingRoutes.get('/owner/stores/:storeId/bookings', ...owners, id('storeId'),
  query('date').custom(isServiceDate), validateRequest, async (req: AuthRequest, res, next) => {
    try { res.json({ data: await BookingService.listOwned(req.user!.id, Number(req.params.storeId), String(req.query.date)) }); } catch (error) { next(error); }
  });
bookingRoutes.patch('/owner/stores/:storeId/bookings/:bookingId/status', ...owners, id('storeId'), id('bookingId'),
  body('status').isIn(['CANCELLED', 'COMPLETED']), validateRequest, async (req: AuthRequest, res, next) => {
    try { res.json({ data: await BookingService.changeStatus(req.user!.id, Number(req.params.bookingId), req.body.status, Number(req.params.storeId)) }); } catch (error) { next(error); }
  });
