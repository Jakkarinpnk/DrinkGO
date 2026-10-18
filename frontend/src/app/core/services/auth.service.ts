import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  catchError,
  finalize,
  map,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiMessageResponse,
  ApiResponse,
  AuthResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  PasswordResetToken,
  RegisterRequest,
  ResetPasswordRequest,
  User,
  UserResponse,
  UpdateProfileRequest,
  VerifyResetOtpRequest,
} from '../../shared/models/user.model';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const CURRENT_USER_KEY = 'currentUser';
const LAST_ACTIVITY_KEY = 'sessionLastActivityAt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  private refreshInFlight$: Observable<string> | null = null;

  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor(private readonly http: HttpClient) {
    this.loadUserFromStorage();
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  register(userData: RegisterRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.apiUrl}/register`, userData);
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  googleLogin(idToken: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/google`, { idToken })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  getProfile(): Observable<User> {
    return this.http.get<UserResponse>(`${this.apiUrl}/profile`).pipe(
      map((response) => response.data),
      tap((user) => this.storeUser(user)),
    );
  }

  updateProfile(profile: UpdateProfileRequest): Observable<User> {
    const formData = new FormData();
    formData.append('email', profile.email);
    formData.append('fullName', profile.fullName);
    formData.append('phone', profile.phone ?? '');
    if (profile.profileImage) {
      formData.append('profileImage', profile.profileImage);
    }

    return this.http.put<UserResponse>(`${this.apiUrl}/profile`, formData).pipe(
      map((response) => response.data),
      tap((user) => this.storeUser(user)),
    );
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiUrl}/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiUrl}/reset-password`, request);
  }

  verifyResetOtp(request: VerifyResetOtpRequest): Observable<PasswordResetToken> {
    return this.http
      .post<ApiResponse<PasswordResetToken>>(`${this.apiUrl}/verify-reset-otp`, request)
      .pipe(map((response) => response.data));
  }

  changePassword(request: ChangePasswordRequest): Observable<ApiMessageResponse> {
    return this.http
      .post<ApiMessageResponse>(`${this.apiUrl}/change-password`, request)
      .pipe(tap(() => this.clearSession()));
  }

  /** Share one refresh call so concurrent 401 responses rotate the token only once. */
  refreshSession(): Observable<string> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('ไม่พบ Refresh Token'));
    }

    this.refreshInFlight$ = this.http
      .post<AuthResponse>(`${this.apiUrl}/refresh`, { refreshToken })
      .pipe(
        tap((response) => this.storeAuthentication(response)),
        map((response) => response.data.accessToken),
        catchError((error) => {
          this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.refreshInFlight$;
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http
        .post<ApiMessageResponse>(`${this.apiUrl}/logout`, { refreshToken })
        .pipe(catchError(() => EMPTY))
        .subscribe();
    }
    this.clearSession();
  }

  recordActivity(): void {
    if (!this.currentUser || this.currentUser.role === 'admin') return;
    this.http
      .post<ApiMessageResponse>(`${this.apiUrl}/activity`, {})
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    if (!this.currentUser || !this.getRefreshToken()) return false;
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    const timeoutMs = environment.sessionIdleTimeoutMinutes * 60 * 1000;
    if (Number.isFinite(lastActivity) && lastActivity > 0 && Date.now() - lastActivity >= timeoutMs) {
      this.clearSession();
      return false;
    }
    return true;
  }

  getPostLoginUrl(returnUrl?: string | null, user: User | null = this.currentUser): string {
    if (user?.role === 'admin') {
      return '/admin';
    }

    return returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
  }

  clearSession(): void {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    this.currentUserSubject.next(null);
  }

  private storeAuthentication(response: AuthResponse): void {
    const { accessToken, refreshToken, user } = response.data;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    this.storeUser(user);
  }

  private storeUser(user: User): void {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private loadUserFromStorage(): void {
    const serializedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (!serializedUser) return;

    try {
      const user = JSON.parse(serializedUser) as User;
      const validRole = ['member', 'owner', 'admin'].includes(user.role);
      if (!user.id || !user.email || !user.fullName || !validRole || !this.getRefreshToken()) {
        throw new Error('Invalid stored user');
      }
      this.currentUserSubject.next(user);
    } catch {
      this.clearSession();
    }
  }
}
