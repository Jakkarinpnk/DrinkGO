import { CommonModule } from '@angular/common';
import { StoreHoursDisplay } from '../../../shared/components/store-hours-display/store-hours-display';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { OwnerApplicationService } from '../../../core/services/owner-application.service';
import { OwnerApplication, OwnerApplicationStatus } from '../../../shared/models/user.model';
import { isMenuPdfUrl } from '../../../shared/menu-file-url';
import { storeImageUrl } from '../../../shared/store-image-url';

type StatusFilter = 'ALL' | OwnerApplicationStatus;

@Component({
  selector: 'app-owner-application-admin',
  standalone: true,
  imports: [CommonModule, StoreHoursDisplay],
  templateUrl: './owner-applications.html',
  styleUrls: ['./owner-applications.css'],
})
export class OwnerApplicationAdmin implements OnInit {
  readonly imageUrl = storeImageUrl;
  readonly isMenuPdf = isMenuPdfUrl;
  private readonly ownerApplicationService = inject(OwnerApplicationService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly filters: { value: StatusFilter; label: string }[] = [
    { value: 'PENDING', label: 'รอตรวจสอบ' },
    { value: 'APPROVED', label: 'อนุมัติแล้ว' },
    { value: 'REJECTED', label: 'ปฏิเสธแล้ว' },
    { value: 'ALL', label: 'ทั้งหมด' },
  ];

  activeFilter: StatusFilter = 'PENDING';
  applications: OwnerApplication[] = [];
  isLoading = true;
  reviewingId: number | null = null;
  downloadingId: number | null = null;
  expandedId: number | null = null;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadApplications();
  }

  setFilter(filter: StatusFilter): void {
    if (this.activeFilter === filter) return;
    this.activeFilter = filter;
    this.expandedId = null;
    this.loadApplications();
  }

  toggleDetails(applicationId: number): void {
    this.expandedId = this.expandedId === applicationId ? null : applicationId;
  }

  isExpanded(applicationId: number): boolean {
    return this.expandedId === applicationId;
  }

  review(application: OwnerApplication, status: 'APPROVED' | 'REJECTED'): void {
    this.reviewingId = application.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.ownerApplicationService.review(application.id, status).subscribe({
      next: (updated) => {
        if (this.activeFilter === 'ALL' || this.activeFilter === status) {
          this.applications = this.applications.map((item) =>
            item.id === updated.id ? updated : item,
          );
        } else {
          this.applications = this.applications.filter((item) => item.id !== updated.id);
          this.expandedId = null;
        }
        this.reviewingId = null;
        this.successMessage =
          status === 'APPROVED'
            ? `อนุมัติคำขอของ ${updated.applicant.fullName} แล้ว`
            : `ปฏิเสธคำขอของ ${updated.applicant.fullName} แล้ว`;
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        this.reviewingId = null;
        this.errorMessage = error.error?.message || 'ไม่สามารถบันทึกผลการตรวจสอบได้';
        this.changeDetector.markForCheck();
      },
    });
  }

  downloadDocument(application: OwnerApplication): void {
    this.downloadingId = application.id;
    this.errorMessage = '';
    this.ownerApplicationService.downloadDocument(application.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = application.document.originalName;
        link.click();
        URL.revokeObjectURL(url);
        this.downloadingId = null;
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        this.downloadingId = null;
        this.errorMessage = error.error?.message || 'ไม่สามารถดาวน์โหลดเอกสารได้';
        this.changeDetector.markForCheck();
      },
    });
  }

  fileSize(size: number): string {
    return size >= 1024 * 1024
      ? `${(size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  statusLabel(status: OwnerApplicationStatus): string {
    return {
      PENDING: 'รอตรวจสอบ',
      APPROVED: 'อนุมัติแล้ว',
      REJECTED: 'ปฏิเสธแล้ว',
    }[status];
  }

  trackApplication(_index: number, application: OwnerApplication): number {
    return application.id;
  }

  private loadApplications(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const status = this.activeFilter === 'ALL' ? undefined : this.activeFilter;
    this.ownerApplicationService.list(status).subscribe({
      next: (applications) => {
        this.applications = applications;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'ไม่สามารถโหลดรายการคำขอได้';
        this.changeDetector.markForCheck();
      },
    });
  }
}
