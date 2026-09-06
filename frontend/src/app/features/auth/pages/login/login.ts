import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

// ประกาศให้ TypeScript รู้จักตัวแปร google ที่มาจาก CDN ของ Google Identity
declare var google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  // 🔥 ตัวแปรเช็คว่า Google โหลดไปแล้วหรือยัง เพื่อป้องกันการโหลดซ้ำซ้อน
  private isGoogleInitialized: boolean = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    // 1. สร้าง Form พร้อม Validation
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // 2. เรียกใช้งานปุ่ม Google (แบบปลอดภัย รอให้ Google SDK โหลดเสร็จ)
    if (typeof google !== 'undefined' && google.accounts) {
      this.initGoogleSignIn();
    } else {
      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
          this.initGoogleSignIn();
          clearInterval(interval);
        }
      }, 100);
    }
  }

  // --- ระบบ Normal Login ---
  onSubmit(): void {
    console.log('--- สัญญาณคลิกปุ่ม Submit สำเร็จ! ---');

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: (res) => {
        this.isLoading = false;
        // 🔥 ไม่ต้องเขียนสั่งเซฟ localStorage เองแล้ว เพราะ AuthService จัดการให้ใน tap เรียบร้อยแล้ว!
        console.log('🚀 ล็อกอินสำเร็จ ย้ายหน้าเข้าสู่หน้าหลัก...');
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      }
    });
  }

  // --- ระบบ Google Login ---
  private initGoogleSignIn(): void {
    // 🔥 เช็คก่อนว่าเคยเปิดตัวไปหรือยัง ถ้าเคยแล้วให้หยุดการทำงานทันที
    if (this.isGoogleInitialized) return;

    try {
      // กำหนดตั้งค่า Google SDK
      google.accounts.id.initialize({
        client_id: '550008448497-m6nb3oig53qt2dnh3fvgarc8ufudt9iq.apps.googleusercontent.com',
        callback: this.handleGoogleResponse.bind(this)
      });

      // วาดปุ่ม Google ลงใน div ที่มี id="google-btn"
      google.accounts.id.renderButton(
        document.getElementById('google-btn'),
        // 🔥 แก้ไข width: '100%' เป็นตัวเลข 250 (หรือ 300) ตามที่ Google Logger แนะนำ
        { theme: 'outline', size: 'large', width: 250 }
      );

      this.isGoogleInitialized = true; // บันทึกสถานะว่าวาดปุ่มเสร็จแล้ว
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการโหลดปุ่ม Google:', error);
    }
  }

  private handleGoogleResponse(response: any): void {
    this.isLoading = true;
    const idToken = response.credential;

    this.authService.googleLogin(idToken).subscribe({
      next: (res) => {
        this.isLoading = false;
        // 🔥 เคลียร์โค้ดให้สะอาดเช่นเดียวกัน
        console.log('🚀 Google ล็อกอินสำเร็จ ย้ายหน้าเข้าสู่หน้าหลัก...');
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Google Login ล้มเหลว กรุณาลองใหม่';
      }
    });
  }
}