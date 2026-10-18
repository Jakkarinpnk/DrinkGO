import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Booking, BookingService, bangkokDate } from '../../core/services/booking.service';
import { AccountSidebar } from '../account/account-sidebar/account-sidebar';
import { storeImageUrl } from '../../shared/store-image-url';

@Component({
  selector: 'app-booking-list', standalone: true, imports: [CommonModule, FormsModule, RouterModule, AccountSidebar],
  templateUrl: './booking-list.html', styleUrls: ['./booking.css', './booking-list.css'],
})
export class BookingList implements OnInit, OnDestroy {
  private readonly api = inject(BookingService);
  private readonly route = inject(ActivatedRoute);
  readonly storeId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly bookings = signal<Booking[]>([]);
  readonly storeName = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly pending = signal<{ booking: Booking; status: 'CANCELLED' | 'COMPLETED' } | null>(null);
  readonly expandedId = signal<number | null>(null);
  readonly imageUrl = storeImageUrl;
  date = bangkokDate();
  searchText = '';
  statusFilter = '';
  page = 1;
  readonly pageSize = 10;
  private loadRequest?: Subscription;
  private mutationRequest?: Subscription;
  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.loadRequest?.unsubscribe(); this.mutationRequest?.unsubscribe(); }
  load(): void {
    this.loadRequest?.unsubscribe(); this.pending.set(null); this.expandedId.set(null);
    this.page = 1; this.error.set(''); this.bookings.set([]);
    if (this.storeId && !this.date) { this.loading.set(false); return; }
    this.loading.set(true);
    if (this.storeId) {
      this.loadRequest = this.api.owned(this.storeId, this.date).subscribe({
        next: data => { this.bookings.set(data.bookings); this.storeName.set(data.storeName); this.loading.set(false); },
        error: err => this.onError(err),
      });
    } else {
      this.loadRequest = this.api.mine().subscribe({ next: rows => { this.bookings.set(rows); this.loading.set(false); }, error: err => this.onError(err) });
    }
  }
  private onError(err: { error?: { message?: string } }): void { this.error.set(err.error?.message || 'โหลดการจองไม่สำเร็จ กรุณาลองใหม่'); this.loading.set(false); }
  statusLabel(status: Booking['status']): string { return { PENDING: 'รอดำเนินการ', CONFIRMED: 'ยืนยันแล้ว', CANCELLED: 'ยกเลิกแล้ว', COMPLETED: 'ใช้บริการแล้ว', NO_SHOW: 'ไม่มาใช้บริการ' }[status]; }
  historyStatusLabel(status: Booking['status']): string { return { PENDING: 'รอตรวจสอบ', CONFIRMED: 'ยืนยันการจอง', CANCELLED: 'ยกเลิกการจอง', COMPLETED: 'เสร็จสิ้น', NO_SHOW: 'ไม่มาใช้บริการ' }[status]; }
  statusIcon(status: Booking['status']): string { return { PENDING: 'schedule', CONFIRMED: 'check', CANCELLED: 'close', COMPLETED: 'check', NO_SHOW: 'event_busy' }[status]; }
  serviceDateLabel(date: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'ยังไม่ระบุ';
    return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })
      .format(new Date(`${date.slice(0, 10)}T12:00:00+07:00`));
  }
  ownerCount(status?: Booking['status']): number {
    return status ? this.bookings().filter(booking => booking.status === status).length : this.bookings().length;
  }
  filteredOwnerBookings(): Booking[] {
    const term = this.searchText.trim().toLocaleLowerCase();
    return this.bookings().filter(booking =>
      (!this.statusFilter || booking.status === this.statusFilter) &&
      (!term || [booking.code, booking.contactName, booking.contactPhone, booking.tableNumber]
        .some(value => value?.toLocaleLowerCase().includes(term))));
  }
  ownerPageCount(): number { return Math.max(1, Math.ceil(this.filteredOwnerBookings().length / this.pageSize)); }
  ownerPageRows(): Booking[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredOwnerBookings().slice(start, start + this.pageSize);
  }
  resetPage(): void { this.page = 1; this.expandedId.set(null); this.pending.set(null); }
  toggleDetails(id: number): void { this.expandedId.update(current => current === id ? null : id); }
  request(booking: Booking, status: 'CANCELLED' | 'COMPLETED'): void { this.message.set(''); this.error.set(''); this.pending.set({ booking, status }); }
  confirm(): void {
    const action = this.pending(); if (!action || this.saving()) return;
    this.saving.set(true); this.error.set('');
    const operation = this.storeId ? this.api.update(this.storeId, action.booking.id, action.status) : this.api.cancel(action.booking.id);
    this.mutationRequest = operation.subscribe({
      next: booking => { this.bookings.update(rows => rows.map(row => row.id === booking.id ? booking : row)); this.page = Math.min(this.page, this.ownerPageCount()); this.saving.set(false); this.pending.set(null); this.message.set(action.status === 'CANCELLED' ? 'ยกเลิกการจองแล้ว' : 'บันทึกว่าใช้บริการแล้ว'); },
      error: err => { this.error.set(err.error?.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่'); this.saving.set(false); },
    });
  }
}
