import { inject } from '@angular/core';
import { HttpRequest, HttpHandlerFn, HttpEvent, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const tokenInterceptor: HttpInterceptorFn = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

    const authService = inject(AuthService);
    const token = authService.getAccessToken();

    let clonedRequest = req;

    // 1. ถ้ามี Token อยู่ (หมายถึงล็อกอินแล้ว) ให้ Clone Request เดิม แล้วสอดไส้ Header เข้าไป
    if (token) {
        clonedRequest = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
    }

    // 2. ปล่อย Request (ที่อาจจะโดนสอดไส้แล้ว) ให้เดินทางต่อไป
    return next(clonedRequest).pipe(
        // 3. ดักจับ Error ที่ตอบกลับมาจาก Backend
        catchError((error: HttpErrorResponse) => {
            // ถ้า Backend ตอบกลับมาเป็น 401 Unauthorized (Token หมดอายุ หรือ ไม่ถูกต้อง)
            if (error.status === 401) {
                // [Future Scope]: ตรงนี้เดี๋ยวเราค่อยมาเพิ่มระบบ "Refresh Token อัตโนมัติ" ในอนาคต
                // แต่ตอนนี้ให้บังคับ Log out แล้วเด้งกลับหน้า Login ไปก่อน
                authService.logout();
                alert('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
                window.location.href = '/auth/login'; // เตะกลับหน้าแรก
            }
            return throwError(() => error);
        })
    );
};