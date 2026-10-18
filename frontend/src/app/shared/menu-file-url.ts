const pathFromUrl = (url: string): string => url.split(/[?#]/, 1)[0].toLowerCase();

export const isMenuImageUrl = (url: string): boolean => /\.(?:jpe?g|png|webp)$/.test(pathFromUrl(url));
export const isMenuPdfUrl = (url: string): boolean => /\.pdf$/.test(pathFromUrl(url));
