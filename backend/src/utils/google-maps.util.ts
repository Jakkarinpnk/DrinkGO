export const isGoogleMapsUrl = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'maps.app.goo.gl') return url.pathname.length > 1;
    if (host === 'goo.gl') return /^\/maps\/.+/.test(url.pathname);
    if (host === 'maps.google.com' || host === 'maps.google.co.th') return true;
    return ['google.com', 'www.google.com', 'google.co.th', 'www.google.co.th'].includes(host)
      && /^\/maps(?:\/|$)/.test(url.pathname);
  } catch {
    return false;
  }
};
