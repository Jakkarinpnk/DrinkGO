import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../shared/models/user.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-account-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './account-sidebar.html',
  styleUrls: ['./account-sidebar.css'],
})
export class AccountSidebar {
  private readonly authService = inject(AuthService);

  readonly currentUser$ = this.authService.currentUser$;

  displayedImage(user: User): string | null {
    if (!user.profileImageUrl) return null;
    if (/^https?:\/\//.test(user.profileImageUrl)) return user.profileImageUrl;
    return `${environment.apiUrl.replace(/\/api\/?$/, '')}${user.profileImageUrl}`;
  }

  initial(user: User): string {
    return user.fullName.trim().charAt(0).toUpperCase() || '?';
  }

  roleLabel(role: User['role']): string {
    return {
      member: 'สมาชิก',
      owner: 'เจ้าของร้าน',
      admin: 'ผู้ดูแลระบบ',
    }[role];
  }
}
