import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http'; // <-- Import เพิ่ม

import { routes } from './app.routes';
import { tokenInterceptor } from './core/interceptors/token.interceptor'; // <-- Import Interceptor ของเรา

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideHttpClient(withInterceptors([tokenInterceptor])) // <-- ลงทะเบียนใช้งานตรงนี้
  ]
};
