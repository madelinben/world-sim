/**
 * Get the correct asset path for both development and production (GitHub Pages)
 * In production, assets need to be prefixed with the basePath
 */
export function getAssetPath(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Use Next.js environment or detect GitHub Pages
  const basePath = process.env.NODE_ENV === 'production' ? '/world-sim' : '';

  return `${basePath}/${cleanPath}`;
}