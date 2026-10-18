import { ValidatorFn } from '@angular/forms';
import { StoreHour } from './models/user.model';

export const weekDays = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
export const emptyWeek = (): StoreHour[] => weekDays.map((_day, dayOfWeek) => ({ dayOfWeek, isClosed: false, openTime: null, closeTime: null, closesNextDay: false }));
export const validHour = (hour: StoreHour): boolean => {
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return !hour.isClosed && typeof hour.openTime === 'string' && typeof hour.closeTime === 'string' && time.test(hour.openTime) && time.test(hour.closeTime) && hour.openTime !== hour.closeTime && hour.closesNextDay === (hour.closeTime < hour.openTime);
};
export const validWeeklyHours = (value: StoreHour[]): boolean => {
  if (!Array.isArray(value) || value.length !== 7 || new Set(value.map(hour => hour?.dayOfWeek)).size !== 7) return false;
  let sharedOpenTime: string | null = null;
  let sharedCloseTime: string | null = null;
  let openDayCount = 0;
  for (const hour of value) {
    if (!hour || !Number.isInteger(hour.dayOfWeek) || hour.dayOfWeek < 0 || hour.dayOfWeek > 6 ||
        typeof hour.isClosed !== 'boolean' || typeof hour.closesNextDay !== 'boolean') return false;
    if (hour.isClosed) {
      if (hour.openTime !== null || hour.closeTime !== null || hour.closesNextDay) return false;
      continue;
    }
    if (!validHour(hour)) return false;
    if (openDayCount === 0) {
      sharedOpenTime = hour.openTime;
      sharedCloseTime = hour.closeTime;
    } else if (hour.openTime !== sharedOpenTime || hour.closeTime !== sharedCloseTime) {
      return false;
    }
    openDayCount += 1;
  }
  return openDayCount > 0;
};
export const weeklyHoursValidator: ValidatorFn = control => {
  const value = control.value as StoreHour[];
  return validWeeklyHours(value) ? null : { weeklyHours: true };
};
