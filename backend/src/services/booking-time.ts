import { AppError } from '../errors/app-error';

export function isServiceDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function serviceWindow(date: string, open: string, close: string) {
  if (!isServiceDate(date)) throw new AppError(422, 'INVALID_DATE', 'วันที่จองไม่ถูกต้อง');
  const start = new Date(`${date}T${open.slice(0, 5)}:00+07:00`);
  const end = new Date(`${date}T${close.slice(0, 5)}:00+07:00`);
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function arrivalFor(date: string, time: string, open: string, close: string): Date {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new AppError(422, 'INVALID_TIME', 'เวลาจองไม่ถูกต้อง');
  const { start, end } = serviceWindow(date, open, close);
  const arrival = new Date(`${date}T${time}:00+07:00`);
  if (close.slice(0, 5) <= open.slice(0, 5) && time < open.slice(0, 5)) arrival.setUTCDate(arrival.getUTCDate() + 1);
  if (arrival < start || arrival >= end) throw new AppError(422, 'OUTSIDE_HOURS', 'กรุณาเลือกเวลาเข้าร้านในช่วงเปิดบริการ');
  return arrival;
}
