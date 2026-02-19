import type { BookFormat } from "@library/shared";

/**
 * Derives the BookFormat from a filename extension.
 * Used by the <Reader> dispatcher (strategy pattern, see section 3.3).
 */
export function detectFormat(filename: string): BookFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'epub': return 'epub';
    case 'pdf': return 'pdf';
    case 'cbz': return 'cbz';
    case 'cbr': return 'cbr';
    default: return null;
  }
}
