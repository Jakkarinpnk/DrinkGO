import { inject } from '@angular/core';
import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

const IS_REFRESH_RETRY = new HttpContextToken<boolean>(() => false);
const AUTH_ENDPOINTS_WITHOUT_RETRY = [
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/verify-reset-otp',
  '/auth/reset-password',
];

const withAccessToken = (request: HttpRequest<unknown>, token: string) =>
  request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

const isApiRequest = (request: HttpRequest<unknown>): boolean =>
  request.url.startsWith(environment.apiUrl);

const shouldSkipRefresh = (request: HttpRequest<unknown>): boolean =>
  AUTH_ENDPOINTS_WITHOUT_RETRY.some((endpoint) => request.url.includes(endpoint));

const redirectToLogin = (router: Router, reason: string): void => {
  void router.navigate(['/auth/login'], {
    queryParams: { returnUrl: router.url, reason },
  });
};

export const tokenInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const accessToken = authService.getAccessToken();
  const apiRequest = isApiRequest(request);
  const authenticatedRequest =
    apiRequest && accessToken ? withAccessToken(request, accessToken) : request;

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (apiRequest && error.status === 403 && error.error?.error?.code === 'ACCOUNT_NOT_ACTIVE') {
        authService.clearSession();
        redirectToLogin(router, 'account-not-active');
        return throwError(() => error);
      }

      const canRefresh =
        apiRequest &&
        error.status === 401 &&
        !request.context.get(IS_REFRESH_RETRY) &&
        !shouldSkipRefresh(request) &&
        Boolean(authService.getRefreshToken());

      if (!canRefresh) {
        if (apiRequest && error.status === 401 && !shouldSkipRefresh(request)) {
          authService.clearSession();
          redirectToLogin(router, 'session-expired');
        }
        return throwError(() => error);
      }

      return authService.refreshSession().pipe(
        switchMap((newAccessToken) =>
          next(
            withAccessToken(
              request.clone({ context: request.context.set(IS_REFRESH_RETRY, true) }),
              newAccessToken,
            ),
          ),
        ),
        catchError((refreshError) => {
          authService.clearSession();
          redirectToLogin(router, 'session-expired');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
