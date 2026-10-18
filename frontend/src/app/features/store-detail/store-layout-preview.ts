import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LayoutBookingStatus, PublicStoreDetail } from '../../shared/models/user.model';
import { storeImageUrl } from '../../shared/store-image-url';

@Component({
  selector: 'app-store-layout-preview', standalone: true, imports: [CommonModule],
  templateUrl: './store-layout-preview.html', styleUrls: ['./store-layout-preview.css'],
})
export class StoreLayoutPreview {
  @Input({ required: true }) item!: PublicStoreDetail;
  @Output() closed = new EventEmitter<void>();
  readonly imageUrl = storeImageUrl;
  closeLayout(): void { this.closed.emit(); }
  layoutStatusLabel(status: LayoutBookingStatus): string {
    return { AVAILABLE: 'เปิดใช้งาน', UNAVAILABLE: 'ปิดใช้งาน', PENDING_PAYMENT: 'ไม่พร้อมใช้งาน', BOOKED: 'จองแล้ว' }[status];
  }
  layoutStatusClass(status: LayoutBookingStatus): string { return status.toLowerCase().replace('_', '-'); }
}
