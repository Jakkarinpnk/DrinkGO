import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { StoreHour } from '../../models/user.model';
import { emptyWeek, validHour, weekDays } from '../../store-hours';

@Component({
  selector: 'app-store-hours-editor', standalone: true, imports: [CommonModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => StoreHoursEditor), multi: true }],
  template: `
    <section aria-labelledby="store-hours-heading">
      <h2 id="store-hours-heading">วันและเวลาเปิดร้าน</h2>
      <p class="hint">เลือกวันที่ร้านเปิดให้บริการ โดยเวลาเปิด–ปิดชุดนี้จะใช้เหมือนกันทุกวันที่เลือก</p>
      <fieldset>
        <legend>วันที่เปิดให้บริการ</legend>
        <div class="day-picker" (keydown.escape)="closeDayDropdown($event)">
          <button #dayTrigger class="day-trigger" type="button" (click)="toggleDayDropdown()" [disabled]="disabled"
            [attr.aria-expanded]="isDayDropdownOpen" aria-controls="store-day-options"
            [attr.aria-label]="'วันที่เปิดให้บริการ: ' + selectedDaysSummary">
            <span class="day-trigger-text">{{ selectedDaysSummary }}</span>
            <span class="day-chevron" [class.open]="isDayDropdownOpen" aria-hidden="true"></span>
          </button>
          <div class="day-dropdown-panel" id="store-day-options" *ngIf="isDayDropdownOpen" role="group" aria-label="เลือกวันที่เปิดให้บริการ">
            <label class="day-option" *ngFor="let day of days; let dayOfWeek = index" [class.selected]="selectedDays[dayOfWeek]">
              <input type="checkbox" [checked]="selectedDays[dayOfWeek]" (change)="toggleDay(dayOfWeek, $event)" (blur)="touch()" [disabled]="disabled">
              <span>{{ day }}</span>
            </label>
          </div>
        </div>
      </fieldset>
      <div class="hour-row">
        <label>เวลาเปิด<input type="time" [value]="openTime || ''" (input)="setTime('openTime', $event)" (blur)="touch()" [disabled]="disabled" aria-label="เวลาเปิดร้าน"></label>
        <label>เวลาปิด<input type="time" [value]="closeTime || ''" (input)="setTime('closeTime', $event)" (blur)="touch()" [disabled]="disabled" aria-label="เวลาปิดร้าน"></label>
      </div>
      <small class="hint next-day" *ngIf="closesNextDay">เวลาปิดอยู่ในวันถัดไป</small>
      <small class="error" *ngIf="touched && selectedDayCount === 0">กรุณาเลือกวันเปิดร้านอย่างน้อย 1 วัน</small>
      <small class="error" *ngIf="touched && selectedDayCount > 0 && !hasValidTime">กรุณาระบุเวลาเปิดกับเวลาปิดให้ครบและต่างกัน</small>
    </section>`,
  styles: [`
    h2 { margin: 24px 0 8px; font-size: 18px; } .hint { color: #64748b; font-size: 13px; line-height: 1.6; }
    fieldset { min-width: 0; margin: 16px 0 4px; padding: 0; border: 0; } legend { margin-bottom: 8px; font-size: 14px; font-weight: 600; color: #334155; }
    .day-picker { position: relative; width: min(100%, 380px); }
    .day-trigger { display: flex; width: 100%; min-height: 44px; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 7px; color: #334155; background: #fff; cursor: pointer; font: inherit; font-size: 14px; text-align: left; }
    .day-trigger:hover, .day-trigger[aria-expanded='true'] { border-color: #ff7a00; }
    .day-trigger:focus-visible { outline: 3px solid rgba(255, 122, 0, .25); outline-offset: 2px; }
    .day-trigger:disabled { cursor: not-allowed; background: #f1f5f9; }
    .day-trigger-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .day-chevron { width: 9px; height: 9px; flex: 0 0 9px; border-right: 2px solid #64748b; border-bottom: 2px solid #64748b; transform: rotate(45deg) translateY(-2px); transition: transform .15s; }
    .day-chevron.open { transform: rotate(225deg) translateY(-2px); }
    .day-dropdown-panel { position: absolute; z-index: 10; top: calc(100% + 5px); left: 0; display: grid; width: 100%; max-height: 290px; overflow-y: auto; padding: 6px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 14%); }
    .day-option { display: flex; min-height: 38px; align-items: center; gap: 10px; padding: 7px 9px; border-radius: 5px; color: #334155; cursor: pointer; font-size: 14px; }
    .day-option:hover, .day-option.selected { background: #fff7ed; }
    .day-option input { width: 16px; height: 16px; margin: 0; accent-color: #ff7a00; cursor: pointer; }
    .day-option:has(input:focus-visible) { outline: 2px solid #ff7a00; outline-offset: -2px; }
    .hour-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 14px 0 8px; font-size: 14px; }
    .hour-row label { display: grid; gap: 5px; }
    .hour-row input { width: 100%; min-width: 0; box-sizing: border-box; padding: 8px; border: 1px solid #cbd5e1; border-radius: 5px; font: inherit; background: #fff; }
    .hour-row input:disabled { background: #f1f5f9; } .error { color: #b42318; } small { display: block; } .next-day { margin-bottom: 4px; }
    @media (max-width: 420px) { .hour-row { grid-template-columns: 1fr; } }
  `],
})
export class StoreHoursEditor implements ControlValueAccessor {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  @ViewChild('dayTrigger') private dayTrigger?: ElementRef<HTMLButtonElement>;
  readonly days = weekDays;
  selectedDays = weekDays.map(() => true);
  isDayDropdownOpen = false;
  openTime: string | null = null;
  closeTime: string | null = null;
  disabled = false;
  touched = false;
  private onChange: (hours: StoreHour[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  writeValue(value: StoreHour[] | null): void {
    const completeWeek = value?.length === 7 && new Set(value.map(hour => hour.dayOfWeek)).size === 7;
    const byDay = completeWeek ? new Map(value.map(hour => [hour.dayOfWeek, hour])) : new Map(emptyWeek().map(hour => [hour.dayOfWeek, hour]));
    this.selectedDays = weekDays.map((_day, dayOfWeek) => !byDay.get(dayOfWeek)?.isClosed);
    const firstOpen = value?.find(hour => !hour.isClosed);
    this.openTime = firstOpen?.openTime ?? null;
    this.closeTime = firstOpen?.closeTime ?? null;
    this.isDayDropdownOpen = false;
    this.touched = false; this.changeDetector.markForCheck();
  }
  registerOnChange(fn: (hours: StoreHour[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; if (disabled) this.isDayDropdownOpen = false; this.changeDetector.markForCheck(); }
  touch(): void { this.touched = true; this.onTouched(); }
  get selectedDayCount(): number { return this.selectedDays.filter(Boolean).length; }
  get selectedDaysSummary(): string {
    if (this.selectedDayCount === 0) return 'เลือกวันที่เปิดให้บริการ';
    if (this.selectedDayCount === 7) return 'ทุกวัน (7 วัน)';
    return `เลือกแล้ว ${this.selectedDayCount} วัน: ${this.days.filter((_day, index) => this.selectedDays[index]).join(', ')}`;
  }
  toggleDayDropdown(): void { if (!this.disabled) this.isDayDropdownOpen = !this.isDayDropdownOpen; }
  closeDayDropdown(event: Event): void {
    if (!this.isDayDropdownOpen) return;
    event.stopPropagation();
    this.isDayDropdownOpen = false;
    this.dayTrigger?.nativeElement.focus();
  }
  @HostListener('document:click', ['$event'])
  closeDayDropdownOnOutsideClick(event: MouseEvent): void {
    if (this.isDayDropdownOpen && !this.host.nativeElement.contains(event.target as Node)) this.isDayDropdownOpen = false;
  }
  get closesNextDay(): boolean { return Boolean(this.openTime && this.closeTime && this.closeTime < this.openTime); }
  get hasValidTime(): boolean {
    return validHour({ dayOfWeek: 0, isClosed: false, openTime: this.openTime, closeTime: this.closeTime, closesNextDay: this.closesNextDay });
  }
  toggleDay(dayOfWeek: number, event: Event): void {
    if (this.disabled) return;
    this.selectedDays = this.selectedDays.map((selected, index) => index === dayOfWeek ? (event.target as HTMLInputElement).checked : selected);
    this.emit();
  }
  setTime(field: 'openTime' | 'closeTime', event: Event): void {
    if (this.disabled) return;
    this[field] = (event.target as HTMLInputElement).value || null;
    this.emit();
  }
  private emit(): void {
    this.touch();
    this.onChange(weekDays.map((_day, dayOfWeek) => this.selectedDays[dayOfWeek] ? {
      dayOfWeek, isClosed: false, openTime: this.openTime, closeTime: this.closeTime, closesNextDay: this.closesNextDay,
    } : { dayOfWeek, isClosed: true, openTime: null, closeTime: null, closesNextDay: false }));
    this.changeDetector.markForCheck();
  }
}
