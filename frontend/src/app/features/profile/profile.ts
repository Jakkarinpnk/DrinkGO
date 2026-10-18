import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../shared/models/user.model';
import { environment } from '../../../environments/environment';
import { AccountSidebar } from '../account/account-sidebar/account-sidebar';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AccountSidebar],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
})
export class Profile implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly profileForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    phone: ['', Validators.pattern(/^\d{9,15}$/)],
  });

  currentUser: User | null = null;
  selectedImage: File | undefined;
  imagePreview: string | null = null;
  errorMessage = '';
  successMessage = '';
  isLoading = false;

  ngOnInit(): void {
    const cachedUser = this.authService.currentUser;
    if (cachedUser) this.setUser(cachedUser);

    this.authService.getProfile().subscribe({
      next: (user) => this.setUser(user),
      error: (error) => {
        this.errorMessage = error.error?.message || 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้';
        this.changeDetector.markForCheck();
      },
    });
  }

  get displayedImage(): string | null {
    if (this.imagePreview) return this.imagePreview;
    const imageUrl = this.currentUser?.profileImageUrl;
    if (!imageUrl) return null;
    if (/^https?:\/\//.test(imageUrl)) return imageUrl;
    return `${environment.apiUrl.replace(/\/api\/?$/, '')}${imageUrl}`;
  }

  get initial(): string {
    return this.currentUser?.fullName.trim().charAt(0).toUpperCase() || '?';
  }

  get roleLabel(): string {
    const labels: Record<User['role'], string> = {
      member: 'สมาชิก',
      owner: 'เจ้าของร้าน',
      admin: 'ผู้ดูแลระบบ',
    };
    return this.currentUser ? labels[this.currentUser.role] : '';
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.errorMessage = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.errorMessage = 'รองรับเฉพาะรูป JPG, PNG และ WebP';
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      this.errorMessage = 'รูปโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB';
      input.value = '';
      return;
    }

    this.selectedImage = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
      this.changeDetector.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const { email, fullName, phone } = this.profileForm.getRawValue();

    this.authService
      .updateProfile({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        profileImage: this.selectedImage,
      })
      .subscribe({
        next: (user) => {
          this.isLoading = false;
          this.selectedImage = undefined;
          this.imagePreview = null;
          this.setUser(user);
          this.successMessage = 'บันทึกข้อมูลโปรไฟล์สำเร็จ';
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้';
          this.changeDetector.markForCheck();
        },
      });
  }

  private setUser(user: User): void {
    this.currentUser = user;
    this.profileForm.patchValue({
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? '',
    });
    this.changeDetector.markForCheck();
  }
}
