import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../../shared/models/user.model';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data['roles'] as Role[] | undefined) ?? [];
  const role = authService.currentUser?.role;

  if (role && allowedRoles.includes(role)) return true;

  void router.navigate(['/']);
  return false;
};
