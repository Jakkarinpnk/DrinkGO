import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StoreService } from '../../../core/services/store.service';
import { googleMapsUrlValidator } from '../../../core/validators/google-maps.validator';
import { OwnedStoreDetail, StoreCategory, StoreServiceStatus } from '../../../shared/models/user.model';
import { isMenuImageUrl } from '../../../shared/menu-file-url';
import { emptyWeek, weeklyHoursValidator } from '../../../shared/store-hours';
import { StoreHoursEditor } from '../../../shared/components/store-hours-editor/store-hours-editor';
import { storeImageUrl } from '../../../shared/store-image-url';
import { AccountSidebar } from '../../account/account-sidebar/account-sidebar';

interface SelectedImage { key: number; file: File; preview: string; }
interface SelectedMenuFile { key: number; file: File; preview: string; }
type SweetAlertApi = (typeof import('sweetalert2/dist/sweetalert2.esm.js'))['default'];
const loadAlerts = async (): Promise<SweetAlertApi> => (await import('sweetalert2/dist/sweetalert2.esm.js')).default;

@Component({
  selector: 'app-store-edit', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AccountSidebar, StoreHoursEditor],
  templateUrl: './store-edit.html', styleUrls: ['./store-edit.css'],
})
export class StoreEdit implements OnInit, OnDestroy {
  private readonly service = inject(StoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);
  readonly imageUrl = storeImageUrl;
  readonly isMenuImage = isMenuImageUrl;
  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(180)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    hours: [emptyWeek(), weeklyHoursValidator],
    description: ['', Validators.maxLength(3000)],
    phone: ['', [Validators.required, Validators.pattern(/^\d{9,15}$/)]],
    lineUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/[^\s]+$/), Validators.maxLength(500)]],
    addressLine: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1000)]],
    province: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    googleMapUrl: ['', [Validators.required, Validators.maxLength(2048), googleMapsUrlValidator]],
    serviceStatus: ['OPEN' as StoreServiceStatus, Validators.required],
  });
  store: OwnedStoreDetail | null = null;
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  successMessage = '';
  imageError = '';
  selectedImages: SelectedImage[] = [];
  removedImageIds: number[] = [];
  coverKey = '';
  private nextImageKey = 0;
  menuFileError = '';
  selectedMenuFiles: SelectedMenuFile[] = [];
  removedMenuFileIds: number[] = [];
  private nextMenuFileKey = 0;
  categories: StoreCategory[] = [];
  categoryError = '';

  ngOnInit(): void { this.loadStore(); this.loadCategories(); }
  loadCategories(): void { this.categoryError = ''; this.service.categories().subscribe({ next: categories => { this.categories = categories; this.changeDetector.markForCheck(); }, error: () => { this.categoryError = 'ไม่สามารถโหลดประเภทร้านได้'; this.changeDetector.markForCheck(); } }); }
  ngOnDestroy(): void { this.clearPreviews(); }

  loadStore(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id < 1) { this.isLoading = false; this.errorMessage = 'ไม่พบร้านค้าของคุณ'; return; }
    this.isLoading = true;
    this.errorMessage = '';
    this.service.getMine(id).subscribe({
      next: store => { this.applyStore(store); this.isLoading = false; this.changeDetector.markForCheck(); },
      error: error => { this.isLoading = false; this.errorMessage = error.error?.message || 'ไม่สามารถโหลดข้อมูลร้านได้'; this.changeDetector.markForCheck(); },
    });
  }

  get visibleImages() { return this.store?.images.filter(image => !this.removedImageIds.includes(image.id)) || []; }
  get visibleMenuFiles() { return this.store?.menuFiles.filter(file => !this.removedMenuFileIds.includes(file.id)) || []; }

  onMenuFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (this.isSaving || !files.length) return;
    this.menuFileError = '';
    this.successMessage = '';
    if (this.visibleMenuFiles.length + this.selectedMenuFiles.length + files.length > 10) {
      this.menuFileError = 'ร้านมีไฟล์เมนูได้ไม่เกิน 10 ไฟล์';
    } else if (files.some(file => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      this.menuFileError = 'ไฟล์เมนูรองรับเฉพาะ PDF, JPG, PNG และ WebP';
    } else if (files.some(file => file.size > 10 * 1024 * 1024)) {
      this.menuFileError = 'ไฟล์เมนูแต่ละไฟล์ต้องมีขนาดไม่เกิน 10 MB';
    } else {
      this.selectedMenuFiles.push(...files.map(file => ({
        key: this.nextMenuFileKey++, file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      })));
    }
    this.changeDetector.markForCheck();
  }

  async removeExistingMenuFile(id: number): Promise<void> {
    if (this.isSaving || !(await this.confirmRemoval('นำไฟล์เมนูออก?', 'ไฟล์จะถูกลบจริงเมื่อกดบันทึกข้อมูล'))) return;
    this.removedMenuFileIds.push(id); this.menuFileError = this.successMessage = ''; this.changeDetector.markForCheck();
  }

  async removeSelectedMenuFile(key: number): Promise<void> {
    if (this.isSaving || !(await this.confirmRemoval('นำไฟล์เมนูนี้ออก?', 'ไฟล์ที่เพิ่งเลือกจะถูกนำออกจากรายการ'))) return;
    const menu = this.selectedMenuFiles.find(file => file.key === key);
    if (menu?.preview) URL.revokeObjectURL(menu.preview);
    this.selectedMenuFiles = this.selectedMenuFiles.filter(file => file.key !== key);
    this.menuFileError = this.successMessage = '';
    this.changeDetector.markForCheck();
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (this.isSaving || !files.length) return;
    this.imageError = '';
    this.successMessage = '';
    if (this.visibleImages.length + this.selectedImages.length + files.length > 10) this.imageError = 'ร้านมีรูปภาพได้ไม่เกิน 10 รูป';
    else if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) this.imageError = 'รองรับเฉพาะรูป JPG, PNG และ WebP';
    else if (files.some(file => file.size > 5 * 1024 * 1024)) this.imageError = 'แต่ละรูปต้องมีขนาดไม่เกิน 5 MB';
    else {
      this.selectedImages.push(...files.map(file => ({ key: this.nextImageKey++, file, preview: URL.createObjectURL(file) })));
      this.ensureCover();
    }
    this.changeDetector.markForCheck();
  }

  async removeExisting(id: number): Promise<void> {
    if (this.isSaving || !(await this.confirmRemoval('นำรูปภาพร้านออก?', 'รูปจะถูกลบจริงเมื่อกดบันทึกข้อมูล'))) return;
    this.removedImageIds.push(id);
    this.imageError = this.successMessage = '';
    this.ensureCover();
    this.changeDetector.markForCheck();
  }

  async removeSelected(key: number): Promise<void> {
    if (this.isSaving || !(await this.confirmRemoval('นำรูปภาพนี้ออก?', 'รูปที่เพิ่งเลือกจะถูกนำออกจากรายการ'))) return;
    const image = this.selectedImages.find(image => image.key === key);
    if (image) URL.revokeObjectURL(image.preview);
    this.selectedImages = this.selectedImages.filter(image => image.key !== key);
    this.imageError = this.successMessage = '';
    this.ensureCover();
    this.changeDetector.markForCheck();
  }

  undoRemoval(): void { if (this.isSaving) return; this.removedImageIds = []; this.ensureCover(); this.changeDetector.markForCheck(); }

  selectCover(key: string): void { if (!this.isSaving) { this.coverKey = key; this.successMessage = ''; this.changeDetector.markForCheck(); } }

  async saveStore(): Promise<void> {
    if (!this.store || this.isSaving) return;
    const raw = this.editForm.getRawValue();
    this.editForm.patchValue(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])));
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); this.changeDetector.markForCheck(); return; }
    const alerts = await loadAlerts();
    const confirmation = await alerts.fire({
      icon: 'question', title: 'ยืนยันการแก้ไขข้อมูลร้าน?',
      text: 'ข้อมูล รูปภาพ และไฟล์เมนูที่เปลี่ยนแปลงจะถูกบันทึก',
      showCancelButton: true, confirmButtonText: 'บันทึกการแก้ไข', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0967cf', cancelButtonColor: '#64748b', reverseButtons: true,
    });
    if (!confirmation.isConfirmed || this.isSaving) return;
    this.isSaving = true;
    this.errorMessage = this.successMessage = this.imageError = this.menuFileError = '';
    this.editForm.disable({ emitEvent: false });
    const value = this.editForm.getRawValue();
    const newCoverIndex = this.selectedImages.findIndex(image => this.coverKey === `new:${image.key}`);
    this.service.updateWithImages(this.store.id, {
      ...value, description: value.description || null,
    }, {
      images: this.selectedImages.map(image => image.file), removedImageIds: this.removedImageIds,
      menuFiles: this.selectedMenuFiles.map(menu => menu.file), removedMenuFileIds: this.removedMenuFileIds,
      coverImageId: this.coverKey.startsWith('existing:') ? Number(this.coverKey.slice(9)) : undefined,
      newCoverIndex: newCoverIndex >= 0 ? newCoverIndex : undefined,
    }).subscribe({
      next: store => {
        this.applyStore(store); this.isSaving = false;
        this.successMessage = 'บันทึกข้อมูล รูปภาพ และไฟล์เมนูร้านเรียบร้อยแล้ว';
        this.editForm.enable({ emitEvent: false }); this.changeDetector.markForCheck();
        void alerts.fire({
          icon: 'success', title: 'แก้ไขข้อมูลร้านสำเร็จ',
          text: 'ระบบจะกลับไปยังหน้าร้านของฉัน', confirmButtonText: 'ตกลง', confirmButtonColor: '#0967cf',
        }).then(() => this.router.navigate(['/owner']));
      },
      error: error => {
        this.isSaving = false; this.editForm.enable({ emitEvent: false });
        this.errorMessage = error.error?.message || 'ไม่สามารถบันทึกข้อมูลร้านได้'; this.changeDetector.markForCheck();
        void alerts.fire({ icon: 'error', title: 'แก้ไขข้อมูลไม่สำเร็จ', text: this.errorMessage, confirmButtonText: 'ตกลง', confirmButtonColor: '#0967cf' });
      },
    });
  }

  invalid(field: keyof typeof this.editForm.controls): boolean { const control = this.editForm.controls[field]; return control.touched && control.invalid; }

  private applyStore(store: OwnedStoreDetail): void {
    this.clearPreviews(); this.removedImageIds = []; this.removedMenuFileIds = [];
    this.store = { ...store, menuFiles: store.menuFiles || [] };
    this.editForm.reset({ ...store, categoryId: store.category?.id || 0, hours: store.hours?.length ? store.hours : emptyWeek(), description: store.description || '' });
    const cover = store.images.find(image => image.isCover) || store.images[0];
    this.coverKey = cover ? `existing:${cover.id}` : '';
  }

  private ensureCover(): void {
    if (this.visibleImages.some(image => this.coverKey === `existing:${image.id}`) || this.selectedImages.some(image => this.coverKey === `new:${image.key}`)) return;
    this.coverKey = this.visibleImages[0] ? `existing:${this.visibleImages[0].id}` : this.selectedImages[0] ? `new:${this.selectedImages[0].key}` : '';
  }

  private async confirmRemoval(title: string, text: string): Promise<boolean> {
    const alerts = await loadAlerts();
    const result = await alerts.fire({
      icon: 'warning', title, text, showCancelButton: true,
      confirmButtonText: 'นำออก', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b', reverseButtons: true,
    });
    return result.isConfirmed;
  }

  private clearPreviews(): void {
    this.selectedImages.forEach(image => URL.revokeObjectURL(image.preview));
    this.selectedMenuFiles.forEach(file => { if (file.preview) URL.revokeObjectURL(file.preview); });
    this.selectedImages = [];
    this.selectedMenuFiles = [];
  }
}
