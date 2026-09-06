import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, AuthResponse } from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;

  // 📦 1. ใช้ BehaviorSubject เพื่อจำสถานะผู้ใช้ล่าสุด (เริ่มต้นเป็น null)
  private currentUserSubject = new BehaviorSubject<any>(null);

  // 🔔 2. เปิด Observable ให้คอมโพเนนต์อื่น ๆ (เช่น Navbar, Main) คอยดักฟังการเปลี่ยนแปลง
  public currentUser$: Observable<any> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  // ฟังก์ชันสําหรับเอาข้อมูล User ใหม่ส่งเข้าท่อกระจายข่าวด้วยมือ (ถ้าจำเป็น)
  public setCurrentUser(user: any): void {
    this.currentUserSubject.next(user);
  }

  // 1. ฟังก์ชันสมัครสมาชิก
  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

  // 2. ฟังก์ชันล็อกอินธรรมดา
  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => this.handleAuthentication(response))
    );
  }

  // 3. ฟังก์ชันล็อกอินด้วย Google
  googleLogin(idToken: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/google`, { idToken }).pipe(
      tap(response => this.handleAuthentication(response))
    );
  }

  // 4. 🔥 ปรับปรุงการแกะกล่องข้อมูลให้เจาะเข้าชั้น .data
  private handleAuthentication(response: any): void {
    if (response && response.data) {
      const authData = response.data; // 🔥 ดึงกล่อง data ออกมาก่อน

      localStorage.setItem('accessToken', authData.accessToken);
      localStorage.setItem('refreshToken', authData.refreshToken);
      localStorage.setItem('currentUser', JSON.stringify(authData.user));

      // ส่งข้อมูลผู้ใช้ตัวจริงเข้าท่อกระจายข่าวให้ Navbar และ Main รู้ตัว
      this.currentUserSubject.next(authData.user);

      console.log('✅ [AuthService] บันทึกข้อมูลและกระจายสัญญาณสำเร็จ:', authData.user);
    }
  }

  // 5. ฟังก์ชันดึง Token ไปใช้งาน
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  // 6. ฟังก์ชันเช็คว่าล็อกอินอยู่หรือไม่
  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  // 7. ฟังก์ชันออกจากระบบ
  public logout(): void {
    // 🔥 แก้ไข: ล้างค่าคีย์ทั้งหมดที่จัดเก็บตอนล็อกอินให้หมดจด
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    this.currentUserSubject.next(null); // 💡 ส่งสัญญาณบอกทุกหน้าว่าล็อกเอาท์แล้วนะ
  }

  // 8. โหลดข้อมูล User เก่าขึ้นมาเมื่อผู้ใช้กดรีเฟรชหน้าเว็บ (F5)
  private loadUserFromStorage(): void {
    const userStr = localStorage.getItem('currentUser');

    // 🔥 เช็คว่าต้องมีข้อมูล และข้อมูลนั้นต้องไม่ใช่คำว่า 'undefined' ถึงจะยอมแปลงค่า JSON
    if (userStr && userStr !== 'undefined') {
      try {
        this.currentUserSubject.next(JSON.parse(userStr));
      } catch (e) {
        console.error('เกิดข้อผิดพลาดในการอ่านข้อมูล User:', e);
        this.logout(); // ถ้าโครงสร้างไฟล์พังให้ล้างทิ้งทันที
      }
    }
  }
}