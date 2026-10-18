import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

const RESET_TOKEN_KEY = 'passwordResetToken';
const RESET_EMAIL_KEY = 'passwordResetEmail';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['../auth-form.shared.css', './forgot-password.css'],
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly otpDigits = ['', '', '', '', '', ''];
  otpSent = false;
  errorMessage = '';
  successMessage = '';
  isSending = false;
  isVerifying = false;

  sendOtp(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.isSending = true;
    this.errorMessage = '';
    this.successMessage = '';
    const email = this.emailForm.controls.email.value.trim().toLowerCase();

    this.authService.forgotPassword({ email }).subscribe({
      next: () => {
        this.isSending = false;
        this.otpSent = true;
        this.emailForm.controls.email.disable();
        this.successMessage = 'ส่งรหัส OTP แล้ว กรุณาตรวจสอบอีเมล';
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        this.isSending = false;
        this.errorMessage = error.error?.message || 'ไม่สามารถขอรหัส OTP ได้ กรุณาลองใหม่';
        this.changeDetector.markForCheck();
      },
    });
  }

  verifyOtp(): void {
    const otp = this.otpDigits.join('');
    if (!/^\d{6}$/.test(otp)) {
      this.errorMessage = 'กรุณากรอก OTP ให้ครบ 6 หลัก';
      return;
    }

    this.isVerifying = true;
    this.errorMessage = '';
    const email = this.emailForm.controls.email.value.trim().toLowerCase();
    this.authService.verifyResetOtp({ email, otp }).subscribe({
      next: ({ resetToken }) => {
        this.isVerifying = false;
        sessionStorage.setItem(RESET_TOKEN_KEY, resetToken);
        sessionStorage.setItem(RESET_EMAIL_KEY, email);
        void this.router.navigate(['/auth/reset-password']);
      },
      error: (error) => {
        this.isVerifying = false;
        this.errorMessage = error.error?.message || 'OTP ไม่ถูกต้องหรือหมดอายุ';
        this.changeDetector.markForCheck();
      },
    });
  }

  changeEmail(): void {
    this.otpSent = false;
    this.otpDigits.fill('');
    this.successMessage = '';
    this.errorMessage = '';
    this.emailForm.controls.email.enable();
  }

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const digit = input.value.replace(/\D/g, '').slice(-1);
    input.value = digit;
    this.otpDigits[index] = digit;
    if (digit && index < 5) this.focusOtpInput(input, index + 1);
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !input.value && index > 0) {
      this.focusOtpInput(input, index - 1);
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    const digits = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    if (!digits) return;
    event.preventDefault();
    digits.split('').forEach((digit, index) => (this.otpDigits[index] = digit));
    const input = event.target as HTMLInputElement;
    const inputs = input.parentElement?.querySelectorAll<HTMLInputElement>('input');
    this.otpDigits.forEach((digit, index) => {
      if (inputs?.[index]) inputs[index].value = digit;
    });
    inputs?.[Math.min(digits.length, 6) - 1]?.focus();
  }

  trackDigit(index: number): number {
    return index;
  }

  private focusOtpInput(input: HTMLInputElement, index: number): void {
    input.parentElement?.querySelectorAll<HTMLInputElement>('input')[index]?.focus();
  }
}
