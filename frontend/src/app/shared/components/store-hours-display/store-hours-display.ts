import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { StoreHour } from '../../models/user.model';
import { validWeeklyHours, weekDays } from '../../store-hours';

@Component({
  selector: 'app-store-hours-display', standalone: true, imports: [CommonModule],
  template: `<div *ngIf="schedule as item; else missing"><p>{{ item.days }}</p><p>เวลา {{ item.openTime }} – {{ item.closeTime }}<small *ngIf="item.closesNextDay"> (ปิดวันถัดไป)</small></p></div><ng-template #missing><p>ยังไม่ระบุวันและเวลาเปิดร้าน</p></ng-template>`,
  styles: [`:host { display: block; margin: 12px 0; font-size: 13px; color: #475569; } p { margin: 0; line-height: 1.6; }`],
})
export class StoreHoursDisplay {
  @Input() hours: StoreHour[] = [];
  get schedule(): { days: string; openTime: string; closeTime: string; closesNextDay: boolean } | null {
    if (!validWeeklyHours(this.hours)) return null;
    const openHours = this.hours.filter(hour => !hour.isClosed);
    const first = openHours[0];
    return {
      days: openHours.length === 7 ? 'เปิดทุกวัน' : `เปิดวัน${openHours.map(hour => weekDays[hour.dayOfWeek]).join(', ')}`,
      openTime: first.openTime!, closeTime: first.closeTime!, closesNextDay: first.closesNextDay,
    };
  }
}
