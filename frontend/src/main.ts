import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

if (window.location.hostname === '127.0.0.1') {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = 'localhost';
  window.location.replace(canonicalUrl);
} else {
  bootstrapApplication(App, appConfig)
    .catch(err => console.error(err));
}
