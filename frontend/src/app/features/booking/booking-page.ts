import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Availability, Booking, BookingService, BookingTable, bangkokDate } from '../../core/services/booking.service';
import { StoreService } from '../../core/services/store.service';
import { PublicStoreDetail } from '../../shared/models/user.model';
import { storeImageUrl } from '../../shared/store-image-url';

@Component({
  selector: 'app-booking-page', standalone: true, imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './booking-page.html', styleUrls: ['./booking.css', './booking-page.css'],
})
export class BookingPage implements OnInit, OnDestroy {
  private readonly api = inject(BookingService);
  private readonly auth = inject(AuthService);
  private readonly stores = inject(StoreService);
  private readonly route = inject(ActivatedRoute);
  readonly storeId = Number(this.route.snapshot.paramMap.get('id'));
  readonly minDate = bangkokDate(-1);
  readonly imageUrl = storeImageUrl;
  readonly availability = signal<Availability | null>(null);
  readonly store = signal<PublicStoreDetail | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal<Booking | null>(null);
  readonly selectedTableIds = signal<number[]>([]);
  private availabilityRequest?: Subscription;
  private createRequest?: Subscription;
  private storeRequest?: Subscription;
  serviceDate = bangkokDate();
  peopleCount = 2;
  arrivalTime = '';
  contactName = this.auth.currentUser?.fullName || '';
  contactPhone = this.auth.currentUser?.phone || '';

  ngOnInit(): void {
    this.loadAvailability();
    this.storeRequest = this.stores.getApproved(this.storeId).subscribe({
      next: store => this.store.set(store),
      error: () => this.store.set(null),
    });
  }
  ngOnDestroy(): void { this.availabilityRequest?.unsubscribe(); this.createRequest?.unsubscribe(); this.storeRequest?.unsubscribe(); }

  loadAvailability(preserveSelection = false): void {
    this.availabilityRequest?.unsubscribe();
    const previousIds = preserveSelection ? this.selectedTableIds() : [];
    const previousTime = preserveSelection ? this.arrivalTime : '';
    this.availability.set(null); this.selectedTableIds.set([]); this.error.set('');
    if (!this.serviceDate || !Number.isInteger(this.peopleCount) || this.peopleCount < 1 || this.peopleCount > 1000) {
      this.loading.set(false); return;
    }
    this.loading.set(true);
    this.availabilityRequest = this.api.availability(this.storeId, this.serviceDate, this.peopleCount).subscribe({
      next: data => {
        this.availability.set(data); this.loading.set(false);
        this.selectedTableIds.set(previousIds.filter(id => data.tables.some(table => table.id === id && this.canSelect(table))));
        const options = this.timeOptions(data);
        this.arrivalTime = options.some(option => option.value === previousTime) ? previousTime : options[0]?.value || '';
      },
      error: err => { this.error.set(err.error?.message || 'โหลดโต๊ะว่างไม่สำเร็จ กรุณาลองใหม่'); this.loading.set(false); },
    });
  }

  timeOptions(data: Availability): { value: string; label: string }[] {
    const start = new Date(`${data.serviceDate}T${data.openTime}:00+07:00`);
    const end = new Date(`${data.serviceDate}T${data.closeTime}:00+07:00`);
    if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
    const result = [];
    for (let at = start.getTime(); at < end.getTime(); at += 30 * 60000) {
      if (at <= Date.now()) continue;
      const local = new Date(at + 7 * 3600000).toISOString();
      const value = local.slice(11, 16);
      result.push({ value, label: `${value} น.${local.slice(0, 10) !== data.serviceDate ? ' (วันถัดไป)' : ''}` });
    }
    return result;
  }

  tableLabel(table: BookingTable): string {
    return { AVAILABLE: 'ว่าง', BOOKED: 'จองแล้ว', INACTIVE: 'ปิดรับจอง', TOO_SMALL: 'ที่นั่งไม่พอ' }[table.state];
  }
  canSelect(table: BookingTable): boolean { return table.state === 'AVAILABLE' || table.state === 'TOO_SMALL'; }
  selectedTables(): BookingTable[] {
    const tables = this.availability()?.tables || [];
    return this.selectedTableIds().flatMap(id => tables.find(table => table.id === id) || []);
  }
  selectedTableNames(): string { return this.selectedTables().map(table => table.tableNumber).join(', '); }
  selectedCapacity(): number { return this.selectedTables().reduce((total, table) => total + table.seatCapacity, 0); }
  toggleTable(table: BookingTable): void {
    if (!this.canSelect(table) || this.saving()) return;
    if (!this.selectedTableIds().includes(table.id) && this.selectedTableIds().length >= 20) {
      this.error.set('เลือกโต๊ะได้สูงสุด 20 โต๊ะต่อรายการจอง');
      return;
    }
    this.selectedTableIds.update(ids => ids.includes(table.id) ? ids.filter(id => id !== table.id) : [...ids, table.id]);
    this.error.set('');
  }
  book(): void {
    if (this.saving()) return;
    if (!this.selectedTableIds().length || !this.arrivalTime || !this.contactPhone || !Number.isInteger(this.peopleCount) ||
        this.peopleCount < 1 || this.peopleCount > this.selectedCapacity()) {
      this.error.set('กรุณาเลือกโต๊ะให้มีที่นั่งรวมเพียงพอ และตรวจสอบข้อมูลการจอง');
      return;
    }
    const payload = { storeId: this.storeId, tableIds: this.selectedTableIds(), serviceDate: this.serviceDate,
      arrivalTime: this.arrivalTime, peopleCount: this.peopleCount };
    this.saving.set(true); this.error.set('');
    this.createRequest = this.api.create(payload).subscribe({
      next: booking => { this.success.set(booking); this.saving.set(false); },
      error: err => {
        this.saving.set(false);
        if (['BOOKING_CONFLICT', 'TABLE_UNAVAILABLE'].includes(err.error?.error?.code)) this.loadAvailability(true);
        this.error.set(err.error?.message || 'ยังยืนยันผลไม่ได้ กรุณาลองจองอีกครั้งด้วยข้อมูลเดิม');
      },
    });
  }
}
