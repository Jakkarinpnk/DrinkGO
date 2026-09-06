import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class Navbar implements OnInit {
  isLoggedIn: boolean = false;
  currentUser: any = null;

  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    // ติดตามสถานะการล็อกอินแบบ Real-time ถ้ามีการ Login/Logout หน้าจอจะเปลี่ยนออโต้
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user; // เปลี่ยนค่า user ให้เป็น boolean (true/false)
    });
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']); // ออกจากระบบแล้วเตะไปหน้า Login
  }
}