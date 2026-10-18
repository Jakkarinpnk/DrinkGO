import { Routes } from '@angular/router';
import { Login } from './features/auth/pages/login/login';
import { Register } from './features/auth/pages/register/register';
import { Main } from './features/auth/pages/main/main';
import { ForgotPassword } from './features/auth/pages/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/pages/reset-password/reset-password';
import { ChangePassword } from './features/auth/pages/change-password/change-password';
import { authGuard } from './core/guards/auth.guard';
import { Profile } from './features/profile/profile';
import { roleGuard } from './core/guards/role.guard';
import { OwnerApplicationPage } from './features/owner-application/owner-application';
import { OwnerApplicationAdmin } from './features/admin/owner-applications/owner-applications';
import { AdminLayout } from './features/admin/layout/admin-layout';
import { AdminDashboard } from './features/admin/dashboard/admin-dashboard';
import { MyStores } from './features/owner/my-stores/my-stores';

export const routes: Routes = [

  { path: '', component: Main },
  { path: 'stores/:id/book', loadComponent: () => import('./features/booking/booking-page').then(m => m.BookingPage),
    canActivate: [authGuard, roleGuard], data: { roles: ['member', 'owner'] } },
  { path: 'bookings', loadComponent: () => import('./features/booking/booking-list').then(m => m.BookingList),
    canActivate: [authGuard, roleGuard], data: { roles: ['member', 'owner'] } },
  { path: 'owner/stores/:id/bookings', loadComponent: () => import('./features/booking/booking-list').then(m => m.BookingList),
    canActivate: [authGuard, roleGuard], data: { roles: ['owner'] } },
  { path: 'stores/:id', loadComponent: () => import('./features/store-detail/store-detail').then(module => module.StoreDetail) },

  { path: 'auth/login', component: Login },
  { path: 'auth/register', component: Register },
  { path: 'auth/forgot-password', component: ForgotPassword },
  { path: 'auth/reset-password', component: ResetPassword },
  { path: 'auth/change-password', component: ChangePassword, canActivate: [authGuard] },
  { path: 'profile', component: Profile, canActivate: [authGuard] },
  {
    path: 'owner-application',
    component: OwnerApplicationPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['member', 'owner'] },
  },
  {
    path: 'owner/stores/:id/edit', loadComponent: () => import('./features/owner/store-edit/store-edit').then(module => module.StoreEdit),
    canActivate: [authGuard, roleGuard], data: { roles: ['member', 'owner'] },
  },
  {
    path: 'owner/stores/:id/tables', loadComponent: () => import('./features/owner/store-tables/store-tables').then(module => module.StoreTables),
    canActivate: [authGuard, roleGuard], data: { roles: ['owner'] },
  },
  {
    path: 'owner/stores/:id/layout', loadComponent: () => import('./features/owner/store-layout/store-layout').then(module => module.StoreLayoutPage),
    canActivate: [authGuard, roleGuard], data: { roles: ['owner'] },
  },
  {
    path: 'owner',
    component: MyStores,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['member', 'owner'] },
  },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    children: [
      { path: '', component: AdminDashboard, pathMatch: 'full' },
      { path: 'owner-applications', component: OwnerApplicationAdmin },
    ],
  },
  { path: '**', redirectTo: '' }

];
