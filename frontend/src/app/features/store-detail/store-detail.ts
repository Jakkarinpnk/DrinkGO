import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StoreService } from '../../core/services/store.service';
import { StoreHoursDisplay } from '../../shared/components/store-hours-display/store-hours-display';
import { PublicStoreDetail, StoreServiceStatus } from '../../shared/models/user.model';
import { StoreLayoutPreview } from './store-layout-preview';
import { isMenuImageUrl, isMenuPdfUrl } from '../../shared/menu-file-url';
import { storeImageUrl } from '../../shared/store-image-url';

@Component({
  selector: 'app-store-detail', standalone: true,
  imports: [CommonModule, RouterModule, StoreHoursDisplay, StoreLayoutPreview],
  templateUrl: './store-detail.html', styleUrls: ['./store-detail.css'],
})
export class StoreDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stores = inject(StoreService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly imageUrl = storeImageUrl;
  readonly isMenuImage = isMenuImageUrl;
  readonly isMenuPdf = isMenuPdfUrl;
  store: PublicStoreDetail | null = null;
  activeImageUrl = '';
  isLoading = true;
  errorMessage = '';
  showLayout = false;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id < 1) {
      this.isLoading = false;
      this.errorMessage = 'ไม่พบร้านค้า';
      return;
    }
    this.stores.getApproved(id).subscribe({
      next: store => {
        this.store = store;
        this.activeImageUrl = store.images.find(image => image.isCover)?.url || store.images[0]?.url || '';
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'ไม่สามารถโหลดรายละเอียดร้านได้';
        this.changeDetector.markForCheck();
      },
    });
  }

  selectImage(url: string): void { this.activeImageUrl = url; }

  openLayout(): void {
    if (!this.store?.layout.imageUrl) return;
    this.showLayout = true;
  }

  closeLayout(): void { this.showLayout = false; }

  requestBooking(): void {
    if (this.store?.serviceStatus === 'OPEN') void this.router.navigate(['/stores', this.store.id, 'book']);
  }

  @HostListener('document:keydown.escape')
  closeLayoutOnEscape(): void { this.closeLayout(); }

  statusLabel(status: StoreServiceStatus): string {
    return { OPEN: 'เปิดให้บริการ', CLOSED_TEMPORARILY: 'ปิดชั่วคราว', CLOSED_PERMANENTLY: 'ปิดถาวร' }[status];
  }
}
