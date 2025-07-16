export const getAbsoluteUrl = (relativePath: string | undefined): string | null => {
  if (!relativePath) return null;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const baseUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001';
  if (relativePath.startsWith('/')) {
    return `${baseUrl}${relativePath}`;
  }
  return `${baseUrl}/${relativePath}`;
};
