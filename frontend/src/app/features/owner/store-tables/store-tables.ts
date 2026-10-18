import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { StoreService } from '../../../core/services/store.service';
import { StoreTable, StoreTableInput, StoreTableStatus } from '../../../shared/models/user.model';
import { AccountSidebar } from '../../account/account-sidebar/account-sidebar';

type SweetAlertApi = (typeof import('sweetalert2/dist/sweetalert2.esm.js'))['default'];
const loadAlerts = async (): Promise<SweetAlertApi> => (await import('sweetalert2/dist/sweetalert2.esm.js')).default;

@Component({
  selector: 'app-store-tables',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AccountSidebar],
  templateUrl: './store-tables.html',
  styleUrls: ['./store-tables.css'],
})
export class StoreTables implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(StoreService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly tableForm = this.fb.nonNullable.group({
    tableNumber: ['', [Validators.required, Validators.maxLength(20)]],
    seatCapacity: [2, [Validators.required, Validators.min(1), Validators.max(100)]],
    status: ['ACTIVE' as StoreTableStatus, Validators.required],
  });

  storeId = 0;
  tables: StoreTable[] = [];
  editingTable: StoreTable | null = null;
  isLoading = true;
  isSaving = false;
  deletingId: number | null = null;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.storeId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(this.storeId) || this.storeId < 1) {
      this.isLoading = false;
      this.errorMessage = 'รหัสร้านไม่ถูกต้อง';
      return;
    }
    this.loadTables();
  }

  get activeCount(): number { return this.tables.filter(table => table.status === 'ACTIVE').length; }
  get totalSeats(): number { return this.tables.filter(table => table.status === 'ACTIVE').reduce((sum, table) => sum + table.seatCapacity, 0); }

  loadTables(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.service.listTables(this.storeId).subscribe({
      next: tables => {
        this.tables = this.sorted(tables);
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.errorMessage = error.error?.message || 'ไม่สามารถโหลดรายการโต๊ะได้';
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  editTable(table: StoreTable): void {
    if (this.isSaving || this.deletingId !== null) return;
    this.editingTable = table;
    this.successMessage = this.errorMessage = '';
    this.tableForm.reset({
      tableNumber: table.tableNumber,
      seatCapacity: table.seatCapacity,
      status: table.status,
    });
    this.changeDetector.markForCheck();
  }

  cancelEdit(): void {
    if (this.isSaving) return;
    this.editingTable = null;
    this.resetForm();
  }

  saveTable(): void {
    if (this.isSaving || this.deletingId !== null) return;
    const trimmedNumber = this.tableForm.controls.tableNumber.value.trim();
    this.tableForm.controls.tableNumber.setValue(trimmedNumber);
    if (this.tableForm.invalid) {
      this.tableForm.markAllAsTouched();
      return;
    }

    const input: StoreTableInput = this.tableForm.getRawValue();
    const request = this.editingTable
      ? this.service.updateTable(this.storeId, this.editingTable.id, input)
      : this.service.createTable(this.storeId, input);
    const editingId = this.editingTable?.id;
    this.isSaving = true;
    this.errorMessage = this.successMessage = '';
    this.tableForm.disable({ emitEvent: false });
    request.subscribe({
      next: table => {
        this.tables = this.sorted(editingId
          ? this.tables.map(item => item.id === table.id ? table : item)
          : [...this.tables, table]);
        this.isSaving = false;
        this.editingTable = null;
        this.tableForm.enable({ emitEvent: false });
        this.resetForm();
        this.successMessage = editingId ? 'แก้ไขข้อมูลโต๊ะเรียบร้อยแล้ว' : 'เพิ่มโต๊ะเรียบร้อยแล้ว';
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.isSaving = false;
        this.tableForm.enable({ emitEvent: false });
        this.errorMessage = error.error?.message || 'ไม่สามารถบันทึกข้อมูลโต๊ะได้';
        this.changeDetector.markForCheck();
      },
    });
  }

  async requestDelete(table: StoreTable): Promise<void> {
    if (this.isSaving || this.deletingId !== null) return;
    const alerts = await loadAlerts();
    const confirmation = await alerts.fire({
      icon: 'warning',
      title: `ลบโต๊ะ ${table.tableNumber}?`,
      text: 'ข้อมูลโต๊ะนี้จะถูกลบออกจากระบบ',
      showCancelButton: true,
      confirmButtonText: 'ลบโต๊ะ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed || this.deletingId !== null) return;
    this.deleteTable(table, alerts);
  }

  tableId(_index: number, table: StoreTable): number { return table.id; }

  statusLabel(status: StoreTableStatus): string {
    return status === 'ACTIVE' ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
  }

  private deleteTable(table: StoreTable, alerts: SweetAlertApi): void {
    this.deletingId = table.id;
    this.errorMessage = this.successMessage = '';
    this.changeDetector.markForCheck();
    this.service.deleteTable(this.storeId, table.id).subscribe({
      next: () => {
        this.tables = this.tables.filter(item => item.id !== table.id);
        if (this.editingTable?.id === table.id) this.cancelEdit();
        this.deletingId = null;
        this.successMessage = `ลบโต๊ะ ${table.tableNumber} เรียบร้อยแล้ว`;
        this.changeDetector.markForCheck();
        void alerts.fire({ icon: 'success', title: 'ลบโต๊ะสำเร็จ', confirmButtonText: 'ตกลง', confirmButtonColor: '#0967cf' });
      },
      error: error => {
        this.deletingId = null;
        this.errorMessage = error.error?.message || 'ไม่สามารถลบโต๊ะได้';
        this.changeDetector.markForCheck();
        void alerts.fire({ icon: 'error', title: 'ลบโต๊ะไม่สำเร็จ', text: this.errorMessage, confirmButtonText: 'ตกลง', confirmButtonColor: '#0967cf' });
      },
    });
  }

  private resetForm(): void {
    this.tableForm.reset({ tableNumber: '', seatCapacity: 2, status: 'ACTIVE' });
    this.changeDetector.markForCheck();
  }

  private sorted(tables: StoreTable[]): StoreTable[] {
    return [...tables].sort((left, right) => left.tableNumber.localeCompare(right.tableNumber, 'th', { numeric: true }));
  }
}
