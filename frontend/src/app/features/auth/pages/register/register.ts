import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { RegisterRequest } from '../../../../shared/models/user.model';

type SweetAlertApi = (typeof import('sweetalert2/dist/sweetalert2.esm.js'))['default'];
const loadAlerts = async (): Promise<SweetAlertApi> => (await import('sweetalert2/dist/sweetalert2.esm.js')).default;

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
  isLoading: boolean = false;
  isSubmitted: boolean = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private changeDetector = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern('^[0-9]{9,15}$')]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(g: FormGroup) {
    const password = g.get('password')?.value;
    const confirmPassword = g.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  onSubmit(): void {
    this.isSubmitted = true;
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    const { fullName, email, phone, password } = this.registerForm.value;
    const sendData: RegisterRequest = { fullName, email, phone: phone || null, password };

    this.authService.register(sendData).subscribe({
      next: () => {
        this.isLoading = false;
        this.changeDetector.markForCheck();
        void loadAlerts()
          .then(alerts => alerts.fire({
            icon: 'success', title: 'สมัครสมาชิกสำเร็จ',
            text: 'กดยืนยันเพื่อไปหน้าเข้าสู่ระบบ',
            confirmButtonText: 'ยืนยัน', confirmButtonColor: '#0967cf',
            allowOutsideClick: false, allowEscapeKey: false,
          }))
          .catch(() => undefined)
          .then(() => this.router.navigate(['/auth/login']));
      },
      error: (err) => {
        this.isLoading = false;
        this.isSubmitted = false;
        this.errorMessage = err.status === 0
          ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่า Backend ทำงานอยู่'
          : err.error?.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
        this.changeDetector.markForCheck();
      }
    });
  }
}
