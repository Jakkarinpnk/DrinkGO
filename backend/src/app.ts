import express from 'express';
import cors from 'cors';
import { body, param, query } from 'express-validator';
import path from 'path';
import { authConfig } from './config/auth.config';
import {
  activityController,
  changePasswordController,
  forgotPasswordController,
  getProfileController,
  googleLoginController,
  loginController,
  logoutController,
  refreshController,
  registerController,
  resetPasswordController,
  updateProfileController,
  verifyResetOtpController,
} from './controllers/auth.controller';
import {
  downloadOwnerApplicationDocumentController,
  getOwnerApplicationStatusController,
  listOwnerApplicationsController,
  reviewOwnerApplicationController,
  submitOwnerApplicationController,
} from './controllers/owner-application.controller';
import { authenticate, authorize } from './middlewares/auth.middleware';
import { uploadBusinessDocument } from './middlewares/business-document.middleware';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { uploadProfileImage } from './middlewares/profile-image.middleware';
import { isGoogleMapsUrl } from './utils/google-maps.util';
import { validateRequest } from './middlewares/validation.middleware';
import {
  listApprovedStoresController,
  getApprovedStoreController,
  listStoreLocationsController,
  listOwnedStoresController,
  updateOwnedStoreController,
  deleteOwnedStoreController,
  getOwnedStoreController,
} from './controllers/store.controller';
import { uploadStoreImages } from './middlewares/store-image.middleware';
import { isStoreHours, StoreOperationsService } from './services/store-operations.service';
import {
  createOwnedStoreTableController,
  deleteOwnedStoreTableController,
  listOwnedStoreTablesController,
  updateOwnedStoreTableController,
} from './controllers/store-table.controller';
import {
  deleteOwnedStoreLayoutImageController,
  getOwnedStoreLayoutController,
  saveOwnedStoreLayoutImageController,
  saveOwnedStoreLayoutTablesController,
} from './controllers/store-layout.controller';
import { uploadStoreLayout } from './middlewares/store-layout.middleware';
import { getAdminStoreStatisticsController } from './controllers/admin-dashboard.controller';
import { bookingRoutes } from './routes/booking.routes';

export const app = express();
const passwordRule = (field: string) =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('รหัสผ่านต้องมีความยาว 8-72 ตัวอักษร');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || authConfig.clientUrls.includes(origin.replace(/\/$/, '')));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/stores',
  query('name').optional().custom(value => typeof value === 'string').bail().trim().isLength({ max: 100 }).withMessage('ชื่อร้านต้องไม่เกิน 100 ตัวอักษร'),
  query('location').optional().custom(value => typeof value === 'string').bail().trim().isLength({ max: 200 }).withMessage('สถานที่ต้องไม่เกิน 200 ตัวอักษร'),
  query('categoryId').optional().custom(value => typeof value === 'string').bail().isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).withMessage('ประเภทร้านไม่ถูกต้อง'),
  validateRequest, listApprovedStoresController);
app.get('/api/stores/:id',
  param('id').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).withMessage('รหัสร้านไม่ถูกต้อง'),
  validateRequest, getApprovedStoreController);
app.get('/api/store-locations', listStoreLocationsController);
app.get('/api/store-categories', async (_req, res, next) => {
  try { res.json({ message: 'ดึงประเภทร้านสำเร็จ', data: await StoreOperationsService.categories() }); } catch (error) { next(error); }
});
const storeOperationsRules = () => [
  body('categoryId').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt().withMessage('กรุณาเลือกประเภทร้าน'),
  body('hours').customSanitizer(value => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }).custom(isStoreHours).withMessage('กรุณาเลือกวันเปิดร้านอย่างน้อย 1 วัน และระบุเวลาเปิด–ปิดชุดเดียวกันโดยเวลาเปิดกับเวลาปิดต้องต่างกัน'),
];
app.get('/api/owner/stores', authenticate, authorize('member', 'owner'), listOwnedStoresController);
app.get('/api/owner/stores/:id', authenticate, authorize('member', 'owner'),
  param('id').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).withMessage('รหัสร้านไม่ถูกต้อง'),
  validateRequest, getOwnedStoreController);
app.put('/api/owner/stores/:id', authenticate, authorize('member', 'owner'),
  uploadStoreImages,
  ...storeOperationsRules(),
  param('id').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).withMessage('รหัสร้านไม่ถูกต้อง'),
  body('name').isString().bail().trim().isLength({ min: 2, max: 180 }).withMessage('ชื่อร้านต้องมี 2-180 ตัวอักษร'),
  body('description').optional({ nullable: true }).isString().bail().trim().isLength({ max: 3000 }).withMessage('รายละเอียดร้านต้องไม่เกิน 3,000 ตัวอักษร'),
  body('phone').isString().bail().trim().matches(/^[0-9]{9,15}$/).withMessage('เบอร์โทรต้องเป็นตัวเลข 9-15 หลัก'),
  body('lineUrl').isString().bail().trim().isURL({ protocols: ['http', 'https'], require_protocol: true }).isLength({ max: 500 }).withMessage('กรุณาระบุลิงก์ LINE ให้ถูกต้องและไม่เกิน 500 ตัวอักษร'),
  body('addressLine').isString().bail().trim().isLength({ min: 5, max: 1000 }).withMessage('ที่อยู่ต้องมี 5-1,000 ตัวอักษร'),
  body(['subdistrict', 'district']).not().exists().withMessage('ระบบใช้จังหวัดและที่อยู่ร้านโดยไม่แยกตำบลหรืออำเภอ'),
  body('province').isString().bail().trim().isLength({ min: 2, max: 120 }).withMessage('จังหวัดต้องมี 2-120 ตัวอักษร'),
  body('googleMapUrl').isString().bail().trim().custom(isGoogleMapsUrl).withMessage('กรุณาระบุลิงก์ Google Maps แบบ https://'),
  body('serviceStatus').isIn(['OPEN', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY']).withMessage('สถานะบริการไม่ถูกต้อง'),
  body('removedImageIds').optional().customSanitizer(value => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }).isArray({ max: 10 }).withMessage('รายการรูปที่นำออกไม่ถูกต้อง'),
  body('removedImageIds.*').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt().withMessage('รหัสรูปไม่ถูกต้อง'),
  body('removedMenuFileIds').optional().customSanitizer(value => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }).isArray({ max: 10 }).withMessage('รายการไฟล์เมนูที่นำออกไม่ถูกต้อง'),
  body('removedMenuFileIds.*').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt().withMessage('รหัสไฟล์เมนูไม่ถูกต้อง'),
  body('coverImageId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).withMessage('รหัสรูปปกไม่ถูกต้อง'),
  body('newCoverIndex').optional({ nullable: true }).isInt({ min: 0, max: 9 }).withMessage('รูปปกใหม่ไม่ถูกต้อง'),
  validateRequest, updateOwnedStoreController,
);
app.delete('/api/owner/stores/:id', authenticate, authorize('member', 'owner'),
  param('id').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).withMessage('รหัสร้านไม่ถูกต้อง'),
  validateRequest, deleteOwnedStoreController,
);

const ownedStoreTableParams = [
  param('storeId').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt().withMessage('รหัสร้านไม่ถูกต้อง'),
];
const storeTableInputRules = () => [
  body('tableNumber').isString().bail().trim().isLength({ min: 1, max: 20 }).withMessage('หมายเลขโต๊ะต้องมี 1-20 ตัวอักษร'),
  body('seatCapacity').isInt({ min: 1, max: 100 }).toInt().withMessage('จำนวนที่นั่งต้องอยู่ระหว่าง 1-100 ที่นั่ง'),
  body('status').isIn(['ACTIVE', 'INACTIVE']).withMessage('สถานะโต๊ะไม่ถูกต้อง'),
];
app.get('/api/owner/stores/:storeId/tables', authenticate, authorize('owner'),
  ...ownedStoreTableParams, validateRequest, listOwnedStoreTablesController);
app.post('/api/owner/stores/:storeId/tables', authenticate, authorize('owner'),
  ...ownedStoreTableParams, ...storeTableInputRules(), validateRequest, createOwnedStoreTableController);
app.put('/api/owner/stores/:storeId/tables/:tableId', authenticate, authorize('owner'),
  ...ownedStoreTableParams,
  param('tableId').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt().withMessage('รหัสโต๊ะไม่ถูกต้อง'),
  ...storeTableInputRules(), validateRequest, updateOwnedStoreTableController);
app.delete('/api/owner/stores/:storeId/tables/:tableId', authenticate, authorize('owner'),
  ...ownedStoreTableParams,
  param('tableId').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt().withMessage('รหัสโต๊ะไม่ถูกต้อง'),
  validateRequest, deleteOwnedStoreTableController);
app.get('/api/owner/stores/:storeId/layout', authenticate, authorize('owner'),
  ...ownedStoreTableParams, validateRequest, getOwnedStoreLayoutController);
app.put('/api/owner/stores/:storeId/layout/image', authenticate, authorize('owner'),
  uploadStoreLayout, ...ownedStoreTableParams, validateRequest, saveOwnedStoreLayoutImageController);
app.delete('/api/owner/stores/:storeId/layout/image', authenticate, authorize('owner'),
  ...ownedStoreTableParams, validateRequest, deleteOwnedStoreLayoutImageController);
app.put('/api/owner/stores/:storeId/layout/tables', authenticate, authorize('owner'),
  ...ownedStoreTableParams,
  body('tables').isArray({ max: 500 }).withMessage('รายการโต๊ะใน Layout ไม่ถูกต้อง'),
  body('tables.*').custom(value => {
    const bothNull = value?.positionX === null && value?.positionY === null;
    const bothNumbers = typeof value?.positionX === 'number' && typeof value?.positionY === 'number';
    return bothNull || bothNumbers;
  }).withMessage('ตำแหน่งโต๊ะต้องระบุทั้งแนวนอนและแนวตั้ง'),
  body('tables.*.id').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt().withMessage('รหัสโต๊ะไม่ถูกต้อง'),
  body('tables.*.positionX').optional({ nullable: true }).isFloat({ min: 0, max: 100 }).toFloat().withMessage('ตำแหน่งแนวนอนต้องอยู่ระหว่าง 0-100'),
  body('tables.*.positionY').optional({ nullable: true }).isFloat({ min: 0, max: 100 }).toFloat().withMessage('ตำแหน่งแนวตั้งต้องอยู่ระหว่าง 0-100'),
  body('tables.*.status').isIn(['ACTIVE', 'INACTIVE']).withMessage('สถานะโต๊ะไม่ถูกต้อง'),
  validateRequest, saveOwnedStoreLayoutTablesController);

app.post(
  '/api/auth/register',
  body('email').isEmail().withMessage('รูปแบบอีเมลไม่ถูกต้อง').normalizeEmail(),
  passwordRule('password'),
  body('fullName').trim().isLength({ min: 2, max: 150 }).withMessage('ชื่อต้องมี 2-150 ตัวอักษร'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9]{9,15}$/)
    .withMessage('เบอร์โทรต้องเป็นตัวเลข 9-15 หลัก'),
  validateRequest,
  registerController,
);

app.post(
  '/api/auth/login',
  body('email').isEmail().withMessage('รูปแบบอีเมลไม่ถูกต้อง').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('กรุณากรอกรหัสผ่าน'),
  validateRequest,
  loginController,
);

app.post(
  '/api/auth/google',
  body('idToken').isString().notEmpty().withMessage('กรุณาระบุ Google ID Token'),
  validateRequest,
  googleLoginController,
);

app.post(
  '/api/auth/refresh',
  body('refreshToken').isString().notEmpty().withMessage('กรุณาระบุ Refresh token'),
  validateRequest,
  refreshController,
);

app.post(
  '/api/auth/logout',
  body('refreshToken').isString().notEmpty().withMessage('กรุณาระบุ Refresh token'),
  validateRequest,
  logoutController,
);

app.post('/api/auth/activity', authenticate, activityController);

app.post(
  '/api/auth/forgot-password',
  body('email').isEmail().withMessage('รูปแบบอีเมลไม่ถูกต้อง').normalizeEmail(),
  validateRequest,
  forgotPasswordController,
);

app.post(
  '/api/auth/verify-reset-otp',
  body('email').isEmail().withMessage('รูปแบบอีเมลไม่ถูกต้อง').normalizeEmail(),
  body('otp').matches(/^[0-9]{6}$/).withMessage('OTP ต้องเป็นตัวเลข 6 หลัก'),
  validateRequest,
  verifyResetOtpController,
);

app.post(
  '/api/auth/reset-password',
  body('resetToken').isString().isLength({ min: 32, max: 2048 }).withMessage('Reset token ไม่ถูกต้อง'),
  passwordRule('newPassword'),
  validateRequest,
  resetPasswordController,
);

app.post(
  '/api/auth/change-password',
  authenticate,
  body('currentPassword').isString().notEmpty().withMessage('กรุณาระบุรหัสผ่านปัจจุบัน'),
  passwordRule('newPassword'),
  validateRequest,
  changePasswordController,
);

app.get('/api/auth/profile', authenticate, getProfileController);

app.put(
  '/api/auth/profile',
  authenticate,
  uploadProfileImage,
  body('email').isEmail().withMessage('รูปแบบอีเมลไม่ถูกต้อง').normalizeEmail(),
  body('fullName').trim().isLength({ min: 2, max: 150 }).withMessage('ชื่อต้องมี 2-150 ตัวอักษร'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9]{9,15}$/)
    .withMessage('เบอร์โทรต้องเป็นตัวเลข 9-15 หลัก'),
  validateRequest,
  updateProfileController,
);

app.post(
  '/api/owner-applications',
  authenticate,
  authorize('member', 'owner'),
  uploadBusinessDocument,
  ...storeOperationsRules(),
  body('storeName')
    .trim()
    .isLength({ min: 2, max: 180 })
    .withMessage('ชื่อร้านต้องมีความยาว 2-180 ตัวอักษร'),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 3000 })
    .withMessage('รายละเอียดร้านต้องไม่เกิน 3,000 ตัวอักษร'),
  body('storePhone')
    .matches(/^[0-9]{9,15}$/)
    .withMessage('เบอร์โทรร้านต้องเป็นตัวเลข 9-15 หลัก'),
  body('lineUrl')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('กรุณาระบุลิงก์ LINE ให้ถูกต้อง')
    .isLength({ max: 500 })
    .withMessage('ลิงก์ LINE ต้องไม่เกิน 500 ตัวอักษร'),
  body('addressLine')
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('ที่อยู่ต้องมีความยาว 5-1,000 ตัวอักษร'),
  body(['subdistrict', 'district']).not().exists().withMessage('ระบบใช้จังหวัดและที่อยู่ร้านโดยไม่แยกตำบลหรืออำเภอ'),
  body('province')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('จังหวัดต้องมีความยาว 2-120 ตัวอักษร'),
  body('googleMapUrl')
    .isString()
    .bail()
    .trim()
    .custom(isGoogleMapsUrl)
    .withMessage('กรุณากรอกลิงก์ Google Maps แบบ https:// ความยาวไม่เกิน 2,048 ตัวอักษร'),
  body('documentType')
    .isIn(['COMMERCIAL_REGISTRATION', 'OTHER'])
    .withMessage('ประเภทเอกสารไม่ถูกต้อง'),
  body('newCoverIndex')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0, max: 9 })
    .withMessage('รูปปกใหม่ไม่ถูกต้อง'),
  validateRequest,
  submitOwnerApplicationController,
);

app.get(
  '/api/owner-applications/status',
  authenticate,
  getOwnerApplicationStatusController,
);

app.get(
  '/api/admin/owner-applications',
  authenticate,
  authorize('admin'),
  query('status')
    .optional()
    .isIn(['PENDING', 'APPROVED', 'REJECTED'])
    .withMessage('สถานะคำขอไม่ถูกต้อง'),
  validateRequest,
  listOwnerApplicationsController,
);

app.get(
  '/api/admin/dashboard/statistics',
  authenticate,
  authorize('admin'),
  getAdminStoreStatisticsController,
);

app.get(
  '/api/admin/owner-applications/:id/document',
  authenticate,
  authorize('admin'),
  param('id').isInt({ min: 1 }).withMessage('รหัสคำขอไม่ถูกต้อง'),
  validateRequest,
  downloadOwnerApplicationDocumentController,
);

app.patch(
  '/api/admin/owner-applications/:id/status',
  authenticate,
  authorize('admin'),
  param('id').isInt({ min: 1 }).withMessage('รหัสคำขอไม่ถูกต้อง'),
  body('status').isIn(['APPROVED', 'REJECTED']).withMessage('สถานะคำขอไม่ถูกต้อง'),
  validateRequest,
  reviewOwnerApplicationController,
);

app.use('/api', bookingRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
