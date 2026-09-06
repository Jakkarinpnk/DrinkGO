import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // ตรวจสอบว่ามี Token ล็อกอินอยู่หรือไม่
  if (authService.isLoggedIn()) {
    return true; // ยอมให้ผ่านเข้าหน้าเว็บได้
  }

  // ถ้ายังไม่ได้ล็อกอิน ให้เตะกลับไปหน้า Login
  // ทริกของ Senior: แนบ URL เดิมไปกับ queryParams ด้วย เผื่อล็อกอินเสร็จจะได้ Redirect กลับมาถูกหน้า
  router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
  return false; // บล็อกการเข้าถึง
};