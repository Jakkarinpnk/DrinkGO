import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // ดึงค่าสิทธิ์ที่อนุญาตจาก Route Data (เราจะไปตั้งค่าในไฟล์ Routing)
    const expectedRoles = route.data['expectedRoles'] as Array<string>;

    // ดึงข้อมูล User ปัจจุบันจาก BehaviorSubject แบบด่วน (เอาค่าล่าสุดแล้ว unsubscribe เลย)
    let currentUser: any;
    authService.currentUser$.subscribe(user => currentUser = user).unsubscribe();

    // ถ้ามี User และสิทธิ์ตรงกับที่ Route นั้นๆ ต้องการ
    if (currentUser && expectedRoles.includes(currentUser.role)) {
        return true;
    }

    // ถ้าสิทธิ์ไม่ถึง (เช่น เป็นแค่ user แต่อยากเข้าหน้า admin) ให้เตะไปหน้าแรก หรือหน้าแจ้งเตือน
    alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้!');
    router.navigate(['/']);
    return false;
};