import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { StoreService } from '../../../core/services/store.service';
import { LayoutBookingStatus, StoreLayout, StoreLayoutTable, StoreTableStatus } from '../../../shared/models/user.model';
import { storeImageUrl } from '../../../shared/store-image-url';
import { AccountSidebar } from '../../account/account-sidebar/account-sidebar';

type SweetAlertApi = (typeof import('sweetalert2/dist/sweetalert2.esm.js'))['default'];
const loadAlerts = async (): Promise<SweetAlertApi> => (await import('sweetalert2/dist/sweetalert2.esm.js')).default;

@Component({
  selector: 'app-store-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AccountSidebar],
  templateUrl: './store-layout.html',
  styleUrls: ['./store-layout.css'],
})
export class StoreLayoutPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(StoreService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  @ViewChild('layoutCanvas') private layoutCanvas?: ElementRef<HTMLElement>;

  storeId = 0;
  layout: StoreLayout | null = null;
  tables: StoreLayoutTable[] = [];
  selectedImage: File | null = null;
  selectedPreview = '';
  draggingId: number | null = null;
  private pointerId: number | null = null;
  isLoading = true;
  isSavingImage = false;
  isSavingTables = false;
  isDeletingImage = false;
  positionsDirty = false;
  errorMessage = '';
  successMessage = '';
  imageError = '';

  ngOnInit(): void {
    this.storeId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(this.storeId) || this.storeId < 1) {
      this.isLoading = false;
      this.errorMessage = 'รหัสร้านไม่ถูกต้อง';
      return;
    }
    this.loadLayout();
  }

  ngOnDestroy(): void { this.clearPreview(); }

  get imageSrc(): string {
    return this.selectedPreview || (this.layout?.imageUrl ? storeImageUrl(this.layout.imageUrl) : '');
  }

  get placedTables(): StoreLayoutTable[] {
    return this.tables.filter(table => table.positionX !== null && table.positionY !== null);
  }

  get unplacedTables(): StoreLayoutTable[] {
    return this.tables.filter(table => table.positionX === null || table.positionY === null);
  }

  get busy(): boolean { return this.isSavingImage || this.isSavingTables || this.isDeletingImage; }

  loadLayout(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.service.getLayout(this.storeId).subscribe({
      next: layout => {
        this.applyLayout(layout);
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.errorMessage = error.error?.message || 'ไม่สามารถโหลด Layout ของร้านได้';
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  selectImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    if (!file || this.busy) return;
    this.imageError = this.successMessage = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageError = 'รองรับเฉพาะรูป JPG, PNG และ WebP';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.imageError = 'รูป Layout ต้องมีขนาดไม่เกิน 5 MB';
      return;
    }
    this.clearPreview();
    this.selectedImage = file;
    this.selectedPreview = URL.createObjectURL(file);
    this.changeDetector.markForCheck();
  }

  cancelImage(): void {
    if (this.isSavingImage) return;
    this.clearPreview();
    this.imageError = '';
    this.changeDetector.markForCheck();
  }

  saveImage(): void {
    if (!this.selectedImage || this.busy) return;
    this.isSavingImage = true;
    this.errorMessage = this.successMessage = this.imageError = '';
    this.service.saveLayoutImage(this.storeId, this.selectedImage).subscribe({
      next: layout => {
        this.applyLayout(layout);
        this.clearPreview();
        this.isSavingImage = false;
        this.successMessage = 'บันทึกรูป Layout เรียบร้อยแล้ว';
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.isSavingImage = false;
        this.imageError = error.error?.message || 'ไม่สามารถบันทึกรูป Layout ได้';
        this.changeDetector.markForCheck();
      },
    });
  }

  async requestDeleteImage(): Promise<void> {
    if (!this.layout?.imageUrl || this.busy) return;
    const alerts = await loadAlerts();
    const confirmation = await alerts.fire({
      icon: 'warning', title: 'ลบรูป Layout?',
      text: 'รูปและตำแหน่งโต๊ะทั้งหมดบน Layout จะถูกลบออก',
      showCancelButton: true, confirmButtonText: 'ลบ Layout', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626', cancelButtonColor: '#64748b', reverseButtons: true,
    });
    if (!confirmation.isConfirmed || this.busy) return;
    this.isDeletingImage = true;
    this.errorMessage = this.successMessage = '';
    this.service.deleteLayoutImage(this.storeId).subscribe({
      next: layout => {
        this.applyLayout(layout);
        this.isDeletingImage = false;
        this.successMessage = 'ลบรูป Layout และตำแหน่งโต๊ะเรียบร้อยแล้ว';
        this.changeDetector.markForCheck();
        void alerts.fire({ icon: 'success', title: 'ลบ Layout สำเร็จ', confirmButtonText: 'ตกลง', confirmButtonColor: '#0967cf' });
      },
      error: error => {
        this.isDeletingImage = false;
        this.errorMessage = error.error?.message || 'ไม่สามารถลบรูป Layout ได้';
        this.changeDetector.markForCheck();
        void alerts.fire({ icon: 'error', title: 'ลบ Layout ไม่สำเร็จ', text: this.errorMessage, confirmButtonText: 'ตกลง', confirmButtonColor: '#0967cf' });
      },
    });
  }

  placeTable(table: StoreLayoutTable): void {
    if (!this.imageSrc || this.busy) return;
    const index = this.placedTables.length;
    table.positionX = Math.min(85, 20 + (index % 4) * 20);
    table.positionY = Math.min(85, 20 + Math.floor(index / 4) * 20);
    this.positionsDirty = true;
    this.successMessage = '';
    this.changeDetector.markForCheck();
  }

  removeTable(table: StoreLayoutTable): void {
    if (this.busy) return;
    table.positionX = null;
    table.positionY = null;
    this.positionsDirty = true;
    this.successMessage = '';
    this.changeDetector.markForCheck();
  }

  startDrag(event: PointerEvent, table: StoreLayoutTable): void {
    if (this.busy || !this.layoutCanvas) return;
    event.preventDefault();
    this.draggingId = table.id;
    this.pointerId = event.pointerId;
    this.layoutCanvas.nativeElement.setPointerCapture(event.pointerId);
    this.updatePosition(event, table);
  }

  moveDrag(event: PointerEvent): void {
    if (this.draggingId === null) return;
    const table = this.tables.find(item => item.id === this.draggingId);
    if (table) this.updatePosition(event, table);
  }

  endDrag(event: PointerEvent): void {
    if (this.draggingId === null) return;
    if (this.layoutCanvas?.nativeElement.hasPointerCapture(event.pointerId)) {
      this.layoutCanvas.nativeElement.releasePointerCapture(event.pointerId);
    }
    this.draggingId = null;
    this.pointerId = null;
    this.positionsDirty = true;
    this.changeDetector.markForCheck();
  }

  changeStatus(table: StoreLayoutTable, event: Event): void {
    if (this.busy || ['PENDING_PAYMENT', 'BOOKED'].includes(table.layoutStatus)) return;
    table.status = (event.target as HTMLSelectElement).value as StoreTableStatus;
    table.layoutStatus = table.status === 'ACTIVE' ? 'AVAILABLE' : 'UNAVAILABLE';
    this.positionsDirty = true;
    this.successMessage = '';
    this.changeDetector.markForCheck();
  }

  saveTables(): void {
    if (!this.layout?.imageUrl || this.busy || !this.positionsDirty) return;
    this.isSavingTables = true;
    this.errorMessage = this.successMessage = '';
    this.service.saveLayoutTables(this.storeId, this.tables.map(table => ({
      id: table.id, positionX: table.positionX, positionY: table.positionY, status: table.status,
    }))).subscribe({
      next: layout => {
        this.applyLayout(layout);
        this.isSavingTables = false;
        this.successMessage = 'บันทึกตำแหน่งและสถานะโต๊ะเรียบร้อยแล้ว';
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.isSavingTables = false;
        this.errorMessage = error.error?.message || 'ไม่สามารถบันทึกตำแหน่งโต๊ะได้';
        this.changeDetector.markForCheck();
      },
    });
  }

  tableId(_index: number, table: StoreLayoutTable): number { return table.id; }

  statusLabel(status: LayoutBookingStatus): string {
    return {
      AVAILABLE: 'เปิดใช้งาน', UNAVAILABLE: 'ปิดใช้งาน', PENDING_PAYMENT: 'ไม่พร้อมใช้งาน', BOOKED: 'จองแล้ว',
    }[status];
  }

  statusClass(status: LayoutBookingStatus): string { return status.toLowerCase().replace('_', '-'); }

  private updatePosition(event: PointerEvent, table: StoreLayoutTable): void {
    if (!this.layoutCanvas || (this.pointerId !== null && event.pointerId !== this.pointerId)) return;
    const rect = this.layoutCanvas.nativeElement.getBoundingClientRect();
    table.positionX = Math.max(3, Math.min(97, ((event.clientX - rect.left) / rect.width) * 100));
    table.positionY = Math.max(4, Math.min(96, ((event.clientY - rect.top) / rect.height) * 100));
    this.positionsDirty = true;
    this.successMessage = '';
    this.changeDetector.markForCheck();
  }

  private applyLayout(layout: StoreLayout): void {
    this.layout = layout;
    this.tables = layout.tables.map(table => ({ ...table }));
    this.positionsDirty = false;
  }

  private clearPreview(): void {
    if (this.selectedPreview) URL.revokeObjectURL(this.selectedPreview);
    this.selectedPreview = '';
    this.selectedImage = null;
  }
}
