import { environment } from '../../environments/environment';

export const storeImageUrl = (url: string): string => `${environment.apiUrl.replace(/\/api\/?$/, '')}${url}`;
