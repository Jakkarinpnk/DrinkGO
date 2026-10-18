import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LoginRequest, User } from '../../../../shared/models/user.model';
import { GoogleSignInButton } from '../../components/google-sign-in-button/google-sign-in-button';

type SweetAlertApi = (typeof import('sweetalert2/dist/sweetalert2.esm.js'))['default'];
const loadAlerts = async (): Promise<SweetAlertApi> => (await import('sweetalert2/dist/sweetalert2.esm.js')).default;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GoogleSignInButton],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';
  infoMessage: string = '';
  isLoading: boolean = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private changeDetector = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.setMessageFromQueryParams();

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const credentials = this.loginForm.getRawValue() as LoginRequest;
    this.authService.login(credentials).subscribe({
      next: (res) => {
        void this.showLoginSuccess(res.data.user);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.status === 0
          ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่า Backend ทำงานอยู่'
          : err.error?.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        this.changeDetector.markForCheck();
      }
    });
  }

  handleGoogleSuccess(idToken: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.changeDetector.markForCheck();

    this.authService.googleLogin(idToken).subscribe({
      next: (res) => {
        void this.showLoginSuccess(res.data.user);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.status === 0
          ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่า Backend ทำงานอยู่'
          : err.error?.message || 'Google Login ล้มเหลว กรุณาลองใหม่';
        this.changeDetector.markForCheck();
      }
    });
  }

  handleGoogleError(message: string): void {
    this.isLoading = false;
    this.errorMessage = message;
    this.changeDetector.markForCheck();
  }

  private async showLoginSuccess(user: User): Promise<void> {
    const destination = this.getPostLoginUrl(user);
    try {
      const alerts = await loadAlerts();
      await alerts.fire({
        icon: 'success', title: 'เข้าสู่ระบบสำเร็จ',
        timer: 1600, showConfirmButton: false,
        allowOutsideClick: false, allowEscapeKey: false,
      });
    } catch {
      // Continue to the authenticated page if the popup cannot load.
    }
    this.isLoading = false;
    this.changeDetector.markForCheck();
    await this.router.navigateByUrl(destination);
  }

  private getPostLoginUrl(user: User): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return this.authService.getPostLoginUrl(returnUrl, user);
  }

  private setMessageFromQueryParams(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    const messages: Record<string, string> = {
      'session-expired': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
      'password-reset': 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ',
      'password-changed': 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง',
      'account-not-active': 'บัญชีถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
    };
    this.infoMessage = reason ? messages[reason] ?? '' : '';
  }
}
