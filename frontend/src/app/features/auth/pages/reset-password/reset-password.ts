import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

const matchingPasswords = (control: AbstractControl): ValidationErrors | null =>
  control.get('newPassword')?.value === control.get('confirmPassword')?.value
    ? null
    : { passwordMismatch: true };

const RESET_TOKEN_KEY = 'passwordResetToken';
const RESET_EMAIL_KEY = 'passwordResetEmail';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.html',
  styleUrls: ['../auth-form.shared.css'],
})
export class ResetPassword implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private resetToken = '';

  email = '';

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchingPasswords },
  );

  errorMessage = '';
  isLoading = false;

  ngOnInit(): void {
    this.resetToken = sessionStorage.getItem(RESET_TOKEN_KEY) ?? '';
    this.email = sessionStorage.getItem(RESET_EMAIL_KEY) ?? '';
    if (!this.resetToken) {
      void this.router.navigate(['/auth/forgot-password']);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const { newPassword } = this.form.getRawValue();

    this.authService.resetPassword({ resetToken: this.resetToken, newPassword }).subscribe({
      next: () => {
        this.isLoading = false;
        sessionStorage.removeItem(RESET_TOKEN_KEY);
        sessionStorage.removeItem(RESET_EMAIL_KEY);
        void this.router.navigate(['/auth/login'], { queryParams: { reason: 'password-reset' } });
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้';
        this.changeDetector.markForCheck();
      },
    });
  }
}
