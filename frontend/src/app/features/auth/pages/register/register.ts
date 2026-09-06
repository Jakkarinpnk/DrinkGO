import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class Register implements OnInit {
  registerForm!: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;
  isSubmitted: boolean = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern('^[0-9]{9,10}$')]], // ยอมรับตัวเลข 9-10 หลัก
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      // ใช้ Validator ตรวจสอบว่ารหัสผ่านทั้ง 2 ช่องตรงกันหรือไม่
      validators: this.passwordMatchValidator
    });
  }

  // ฟังก์ชันเช็ครหัสผ่านตรงกัน
  passwordMatchValidator(g: FormGroup) {
    const password = g.get('password')?.value;
    const confirmPassword = g.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  onSubmit(): void {
    this.isSubmitted = true; // 🔥 บรรทัดแรกสุด: สั่งเปิดสวิตช์ทันทีที่กดปุ่มลงทะเบียน

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { fullName, email, phone, password } = this.registerForm.value;
    const sendData = { fullName, email, phone: phone || null, password };

    this.authService.register(sendData).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = 'สมัครสมาชิกสำเร็จ! กำลังพาท่านไปหน้าเข้าสู่ระบบ...';
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 2000);
      },
      error: (err) => {
        this.isLoading = false;
        this.isSubmitted = false; // 💡 หากสมัครไม่สำเร็จ ปรับกลับเป็น false เพื่อให้กรอกใหม่
        this.errorMessage = err.error?.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
      }
    });
  }
}