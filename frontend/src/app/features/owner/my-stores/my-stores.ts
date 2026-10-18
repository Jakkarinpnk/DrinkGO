import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { storeImageUrl } from '../../../shared/store-image-url';
import { StoreService } from '../../../core/services/store.service';
import {
  OwnedStoreSummary,
  StoreServiceStatus,
} from '../../../shared/models/user.model';
import { AccountSidebar } from '../../account/account-sidebar/account-sidebar';
import { StoreHoursDisplay } from '../../../shared/components/store-hours-display/store-hours-display';

interface StoreGroup {
  key: 'approved' | 'pending' | 'action-required';
  title: string;
  description: string;
  emptyMessage: string;
  stores: OwnedStoreSummary[];
}

type SweetAlertApi = (typeof import('sweetalert2/dist/sweetalert2.esm.js'))['default'];
const loadAlerts = async (): Promise<SweetAlertApi> => (await import('sweetalert2/dist/sweetalert2.esm.js')).default;

@Component({
  selector: 'app-my-stores',
  standalone: true,
  imports: [CommonModule, RouterModule, AccountSidebar, StoreHoursDisplay],
  templateUrl: './my-stores.html',
  styleUrls: ['./my-stores.css'],
})
export class MyStores implements OnInit {
  private readonly storeService = inject(StoreService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  readonly imageUrl = storeImageUrl;
  deletingStore: OwnedStoreSummary | null = null;
  isSaving = false;
  actionError = '';
  successMessage = '';

  stores: OwnedStoreSummary[] = [];
  isLoading = true;
  errorMessage = '';

  async requestDelete(store: OwnedStoreSummary): Promise<void> {
    if (this.isSaving) return;
    this.actionError = this.successMessage = '';
    const alerts = await loadAlerts();
    const confirmation = await alerts.fire({
      icon: 'warning', title: `ลบร้าน ${store.name}?`,
      text: 'ข้อมูลร้าน รูปภาพ และไฟล์เมนูของร้านนี้จะถูกลบออกจากระบบ',
      showCancelButton: true, confirmButtonText: 'ลบร้าน', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626', cancelButtonColor: '#64748b', reverseButtons: true,
    });
    if (!confirmation.isConfirmed || this.isSaving) return;
    this.deletingStore = store;
    this.deleteStore(alerts);
  }

  deleteStore(alerts: SweetAlertApi): void {
    if (!this.deletingStore || this.isSaving) return;
    const id = this.deletingStore.id;
    this.isSaving = true;
    this.actionError = '';
    this.changeDetector.markForCheck();
    this.storeService.delete(id).subscribe({
      next: () => {
        this.stores = this.stores.filter(store => store.id !== id);
        this.deletingStore = null;
        this.isSaving = false;
        this.successMessage = 'ลบร้านเรียบร้อยแล้ว';
        this.changeDetector.markForCheck();
        void alerts.fire({
          icon: 'success', title: 'ลบร้านสำเร็จ', text: 'ระบบจะกลับไปยังหน้าร้านของฉัน',
          confirmButtonText: 'ตกลง', confirmButtonColor: '#0967cf',
        }).then(() => this.router.navigate(['/owner']));
      },
      error: error => this.actionFailed(error, 'ไม่สามารถลบร้านได้', alerts),
    });
  }

  groupKey(_index: number, group: StoreGroup): string { return group.key; }
  storeId(_index: number, store: OwnedStoreSummary): number { return store.id; }

  private actionFailed(error: { error?: { message?: string } }, fallback: string, alerts: SweetAlertApi): void {
    this.isSaving = false;
    this.actionError = error.error?.message || fallback;
    this.changeDetector.markForCheck();
    void alerts.fire({ icon: 'error', title: 'ลบร้านไม่สำเร็จ', text: this.actionError, confirmButtonText: 'ตกลง', confirmButtonColor: '#0967cf' });
  }

  ngOnInit(): void {
    this.loadStores();
  }

  get storeGroups(): StoreGroup[] {
    return [
      {
        key: 'approved',
        title: 'ร้านที่อนุมัติแล้ว',
        description: 'ร้านที่ผ่านการอนุมัติจากผู้ดูแลระบบแล้ว',
        emptyMessage: 'ยังไม่มีร้านที่ได้รับการอนุมัติ',
        stores: this.stores.filter((store) => store.approvalStatus === 'APPROVED'),
      },
      {
        key: 'pending',
        title: 'กำลังตรวจสอบ',
        description: 'ร้านที่ส่งข้อมูลแล้วและกำลังรอผู้ดูแลระบบตรวจสอบ',
        emptyMessage: 'ไม่มีร้านที่กำลังรอตรวจสอบ',
        stores: this.stores.filter((store) => store.approvalStatus === 'PENDING'),
      },
      {
        key: 'action-required',
        title: 'ต้องดำเนินการ',
        description: 'ร้านที่ไม่ผ่านการอนุมัติ',
        emptyMessage: 'ไม่มีร้านที่ต้องดำเนินการ',
        stores: this.stores.filter((store) => store.approvalStatus === 'REJECTED'),
      },
    ];
  }

  loadStores(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.storeService.listMine().subscribe({
      next: (stores) => {
        this.stores = stores;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'ไม่สามารถโหลดร้านของคุณได้';
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  location(store: OwnedStoreSummary): string {
    return store.province;
  }

  serviceLabel(status: StoreServiceStatus): string {
    return {
      OPEN: 'เปิดให้บริการ',
      CLOSED_TEMPORARILY: 'ปิดชั่วคราว',
      CLOSED_PERMANENTLY: 'ปิดถาวร',
    }[status];
  }
}
