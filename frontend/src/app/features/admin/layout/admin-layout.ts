import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

type SweetAlertApi = (typeof import('sweetalert2/dist/sweetalert2.esm.js'))['default'];
const loadAlerts = async (): Promise<SweetAlertApi> => (await import('sweetalert2/dist/sweetalert2.esm.js')).default;

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css'],
})
export class AdminLayout {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isSidebarOpen = false;
  isLoggingOut = false;

  get currentUser() {
    return this.authService.currentUser;
  }

  get displayedImage(): string | null {
    const imageUrl = this.currentUser?.profileImageUrl;
    if (!imageUrl) return null;
    if (/^https?:\/\//.test(imageUrl)) return imageUrl;
    return `${environment.apiUrl.replace(/\/api\/?$/, '')}${imageUrl}`;
  }

  get initial(): string {
    return this.currentUser?.fullName.trim().charAt(0).toUpperCase() || 'A';
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  async onLogout(): Promise<void> {
    if (this.isLoggingOut) return;
    this.closeSidebar();
    this.isLoggingOut = true;
    const alerts = await loadAlerts();
    const confirmation = await alerts.fire({
      icon: 'question',
      title: 'ยืนยันการออกจากระบบ?',
      text: 'คุณจะต้องเข้าสู่ระบบอีกครั้งเมื่อต้องการจัดการระบบต่อ',
      showCancelButton: true,
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
    });
    this.isLoggingOut = false;
    if (!confirmation.isConfirmed) return;
    this.authService.logout();
    void this.router.navigate(['/auth/login']);
  }
}
