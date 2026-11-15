/**
 * Helper to resolve uploaded image paths to full URLs.
 * If path is relative (e.g. '/uploads/products/...'), it prepends VITE_API_URL if configured.
 * Also handles fallback if an image fails to load.
 */
export const getImageUrl = (path) => {
  if (!path || typeof path !== 'string') return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path;
  }

  const apiBase = import.meta.env.VITE_API_URL;
  if (apiBase) {
    const origin = apiBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${origin}${cleanPath}`;
  }

  return path;
};

