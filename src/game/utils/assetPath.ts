/**
 * Get the correct asset path for both development and production (GitHub Pages)
 * In production, assets need to be prefixed with the basePath
 */
export function getAssetPath(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // In production (GitHub Pages), we need to include the basePath
  if (typeof window !== 'undefined' && window.location.hostname === 'madelinben.github.io') {
    return `/world-sim/${cleanPath}`;
  }

  // In development, use the path as-is with leading slash
  return `/${cleanPath}`;
}