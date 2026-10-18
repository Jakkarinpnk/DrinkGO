import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { AdminDashboardService } from '../../../core/services/admin-dashboard.service';
import { AdminStoreStatistics } from '../../../shared/models/user.model';
import { AdminReviewSummary } from './components/review-summary/review-summary';
import { AdminStatCard } from './components/stat-card/stat-card';
import { AdminSystemChart } from './components/system-chart/system-chart';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, AdminStatCard, AdminReviewSummary, AdminSystemChart],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css'],
})
export class AdminDashboard implements OnInit {
  private readonly dashboardService = inject(AdminDashboardService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  statistics: AdminStoreStatistics | null = null;
  isLoading = true;
  errorMessage = '';

  get statisticCards(): Array<{ label: string; icon: string; value: string | number }> {
    return [
      { label: 'ผู้ใช้งานออนไลน์', icon: 'online_prediction', value: this.statistics?.onlineUsers ?? '—' },
      { label: 'ผู้ใช้ทั้งหมด', icon: 'group', value: this.statistics?.totalUsers ?? '—' },
      { label: 'ร้านค้าทั้งหมด', icon: 'storefront', value: this.statistics?.totalStores ?? '—' },
      { label: 'รอตรวจสอบ', icon: 'pending_actions', value: this.statistics?.pendingStores ?? '—' },
      { label: 'ร้านที่อนุมัติแล้ว', icon: 'verified', value: this.statistics?.approvedStores ?? '—' },
      { label: 'รายงานปัญหา', icon: 'report_problem', value: '—' },
    ];
  }

  ngOnInit(): void { this.loadStatistics(); }

  loadStatistics(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.dashboardService.storeStatistics().subscribe({
      next: statistics => {
        this.statistics = statistics;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.errorMessage = error.error?.message || 'ไม่สามารถโหลดสถิติภาพรวมได้';
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}
