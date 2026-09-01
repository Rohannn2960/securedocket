/**
 * Format ISO date string into standard military / court format
 */
export function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Truncate SHA-256 hash for human-readable badge display
 */
export function truncateHash(hash, leading = 8, trailing = 8) {
  if (!hash || typeof hash !== 'string') return '—';
  if (hash.length <= leading + trailing) return hash;
  return `${hash.substring(0, leading)}...${hash.substring(hash.length - trailing)}`;
}

/**
 * Format bytes into human-readable size
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
