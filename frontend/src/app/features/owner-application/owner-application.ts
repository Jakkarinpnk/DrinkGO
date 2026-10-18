import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { StoreService } from '../../core/services/store.service';
import { emptyWeek, weeklyHoursValidator } from '../../shared/store-hours';
import { StoreCategory } from '../../shared/models/user.model';
import { StoreHoursEditor } from '../../shared/components/store-hours-editor/store-hours-editor';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OwnerApplicationService } from '../../core/services/owner-application.service';
import { googleMapsUrlValidator } from '../../core/validators/google-maps.validator';
import {
  BusinessDocumentType,
  OwnerApplication,
} from '../../shared/models/user.model';
import { AccountSidebar } from '../account/account-sidebar/account-sidebar';

const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const MAX_STORE_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_STORE_IMAGES = 10;
interface SelectedImage { key: number; file: File; preview: string; }
interface SelectedMenuFile { key: number; file: File; preview: string; }

@Component({
  selector: 'app-owner-application',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AccountSidebar, StoreHoursEditor],
  templateUrl: './owner-application.html',
  styleUrls: ['./owner-application.css'],
})
export class OwnerApplicationPage implements OnInit, OnDestroy {
  private readonly stores = inject(StoreService);
  categories: StoreCategory[] = [];
  categoryError = '';
  ngOnInit(): void { this.loadCategories(); }
  ngOnDestroy(): void { this.clearImagePreviews(); this.clearMenuPreviews(); }
  loadCategories(): void { this.categoryError = ''; this.stores.categories().subscribe({ next: categories => { this.categories = categories; this.changeDetector.markForCheck(); }, error: () => { this.categoryError = 'ไม่สามารถโหลดประเภทร้านได้'; this.changeDetector.markForCheck(); } }); }
  private readonly fb = inject(FormBuilder);
  private readonly ownerApplicationService = inject(OwnerApplicationService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly applicationForm = this.fb.nonNullable.group({
    storeName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(180)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    hours: [emptyWeek(), weeklyHoursValidator],
    description: ['', Validators.maxLength(3000)],
    storePhone: ['', [Validators.required, Validators.pattern(/^\d{9,15}$/)]],
    lineUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    addressLine: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1000)]],
    province: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    googleMapUrl: ['', [Validators.required, Validators.maxLength(2048), googleMapsUrlValidator]],
    documentType: ['COMMERCIAL_REGISTRATION' as BusinessDocumentType, Validators.required],
  });

  application: OwnerApplication | null = null;
  selectedDocument: File | null = null;
  isSubmitting = false;
  errorMessage = '';
  fileError = '';
  imageError = '';
  selectedImages: SelectedImage[] = [];
  coverKey = '';
  private nextImageKey = 0;
  menuFileError = '';
  selectedMenuFiles: SelectedMenuFile[] = [];
  private nextMenuFileKey = 0;

  onMenuFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (this.isSubmitting || !files.length) return;
    this.menuFileError = '';
    if (this.selectedMenuFiles.length + files.length > 10) {
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

  removeSelectedMenuFile(key: number): void {
    if (this.isSubmitting) return;
    const menu = this.selectedMenuFiles.find(file => file.key === key);
    if (menu?.preview) URL.revokeObjectURL(menu.preview);
    this.selectedMenuFiles = this.selectedMenuFiles.filter(file => file.key !== key);
    this.menuFileError = '';
    this.changeDetector.markForCheck();
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (this.isSubmitting || !files.length) return;
    this.imageError = '';
    if (this.selectedImages.length + files.length > MAX_STORE_IMAGES) {
      this.imageError = 'ร้านมีรูปภาพได้ไม่เกิน 10 รูป';
    } else if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      this.imageError = 'รองรับเฉพาะรูป JPG, PNG และ WebP';
    } else if (files.some(file => file.size > MAX_STORE_IMAGE_SIZE)) {
      this.imageError = 'แต่ละรูปต้องมีขนาดไม่เกิน 5 MB';
    } else {
      this.selectedImages.push(...files.map(file => ({ key: this.nextImageKey++, file, preview: URL.createObjectURL(file) })));
      if (!this.coverKey && this.selectedImages[0]) this.coverKey = `new:${this.selectedImages[0].key}`;
    }
    this.changeDetector.markForCheck();
  }

  removeSelectedImage(key: number): void {
    if (this.isSubmitting) return;
    const image = this.selectedImages.find(item => item.key === key);
    if (image) URL.revokeObjectURL(image.preview);
    this.selectedImages = this.selectedImages.filter(item => item.key !== key);
    if (!this.selectedImages.some(item => this.coverKey === `new:${item.key}`)) {
      this.coverKey = this.selectedImages[0] ? `new:${this.selectedImages[0].key}` : '';
    }
    this.imageError = '';
    this.changeDetector.markForCheck();
  }

  selectCover(key: number): void {
    if (!this.isSubmitting) this.coverKey = `new:${key}`;
  }

  onDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError = '';
    this.selectedDocument = null;
    if (!file) return;

    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      this.fileError = 'รองรับเฉพาะไฟล์ PDF, JPG และ PNG';
      input.value = '';
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      this.fileError = 'เอกสารต้องมีขนาดไม่เกิน 10 MB';
      input.value = '';
      return;
    }
    this.selectedDocument = file;
  }

  onSubmit(): void {
    if (this.applicationForm.invalid || !this.selectedDocument) {
      this.applicationForm.markAllAsTouched();
      if (!this.selectedDocument) this.fileError = 'กรุณาแนบเอกสารยืนยันธุรกิจ';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    const value = this.applicationForm.getRawValue();
    const newCoverIndex = this.selectedImages.findIndex(image => this.coverKey === `new:${image.key}`);
    this.ownerApplicationService
      .submit({
        ...value,
        storeName: value.storeName.trim(),
        description: value.description.trim(),
        storePhone: value.storePhone.trim(),
        lineUrl: value.lineUrl.trim(),
        addressLine: value.addressLine.trim(),
        province: value.province.trim(),
        googleMapUrl: value.googleMapUrl.trim(),
        businessDocument: this.selectedDocument,
        images: this.selectedImages.map(image => image.file),
        menuFiles: this.selectedMenuFiles.map(menu => menu.file),
        newCoverIndex: newCoverIndex >= 0 ? newCoverIndex : undefined,
      })
      .subscribe({
        next: (application) => {
          this.application = application;
          this.isSubmitting = false;
          this.clearImagePreviews();
          this.clearMenuPreviews();
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          this.isSubmitting = false;
          this.errorMessage = error.error?.message || 'ไม่สามารถส่งคำขอได้';
          this.changeDetector.markForCheck();
        },
      });
  }

  private clearImagePreviews(): void {
    this.selectedImages.forEach(image => URL.revokeObjectURL(image.preview));
    this.selectedImages = [];
    this.coverKey = '';
  }

  private clearMenuPreviews(): void {
    this.selectedMenuFiles.forEach(file => { if (file.preview) URL.revokeObjectURL(file.preview); });
    this.selectedMenuFiles = [];
  }

}
