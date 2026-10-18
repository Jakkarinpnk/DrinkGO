import { ValidatorFn } from '@angular/forms';

export const googleMapsUrlValidator: ValidatorFn = (control) => {
  const value = control.value;
  if (!value) return null; // Validators.required handles an empty field.
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) {
      return { googleMapsUrl: true };
    }
    const host = url.hostname.toLowerCase();
    const valid = (host === 'maps.app.goo.gl' && url.pathname.length > 1)
      || (host === 'goo.gl' && /^\/maps\/.+/.test(url.pathname))
      || ['maps.google.com', 'maps.google.co.th'].includes(host)
      || (['google.com', 'www.google.com', 'google.co.th', 'www.google.co.th'].includes(host)
        && /^\/maps(?:\/|$)/.test(url.pathname));
    return valid ? null : { googleMapsUrl: true };
  } catch {
    return { googleMapsUrl: true };
  }
};
