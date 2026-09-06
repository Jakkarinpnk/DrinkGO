import { Routes } from '@angular/router';
import { Login } from './features/auth/pages/login/login';
import { Register } from './features/auth/pages/register/register';
import { Main } from './features/auth/pages/main/main';

export const routes: Routes = [

  { path: '', component: Main },

  { path: 'auth/login', component: Login },
  { path: 'auth/register', component: Register }

];