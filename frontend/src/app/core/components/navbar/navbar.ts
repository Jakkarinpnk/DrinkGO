import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../../shared/models/user.model';

type SweetAlertApi = (typeof import('sweetalert2/dist/sweetalert2.esm.js'))['default'];
const loadAlerts = async (): Promise<SweetAlertApi> => (await import('sweetalert2/dist/sweetalert2.esm.js')).default;

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class Navbar implements OnInit {
  isLoggedIn: boolean = false;
  currentUser: User | null = null;
  isUserMenuOpen = false;
  isLoggingOut = false;

  private authService = inject(AuthService);
  private router = inject(Router);
  private changeDetector = inject(ChangeDetectorRef);

  ngOnInit(): void {
    // ติดตามสถานะการล็อกอินแบบ Real-time ถ้ามีการ Login/Logout หน้าจอจะเปลี่ยนออโต้
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user; // เปลี่ยนค่า user ให้เป็น boolean (true/false)
      this.changeDetector.markForCheck();
    });
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  async onLogout(): Promise<void> {
    if (this.isLoggingOut) return;
    this.closeUserMenu();
    this.isLoggingOut = true;
    const alerts = await loadAlerts();
    const confirmation = await alerts.fire({
      icon: 'question',
      title: 'ยืนยันการออกจากระบบ?',
      text: 'คุณจะต้องเข้าสู่ระบบอีกครั้งเมื่อต้องการใช้งานต่อ',
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
