import path from "node:path";
import type { BookFormat } from "@digital-library/shared";
import { extractCbrMetadata } from "./metadata/extractCbrMetadata.js";
import { extractCbzMetadata } from "./metadata/extractCbzMetadata.js";
import { extractEpubMetadata } from "./metadata/extractEpubMetadata.js";
import { extractPdfMetadata } from "./metadata/extractPdfMetadata.js";

export interface ExtractedMetadata {
  title: string;
  author?: string;
  description?: string;
  isbn?: string;
  published_at?: string;
  page_count?: number;
  cover_data?: Buffer;
  cover_ext?: string;
}

export async function extractMetadata(
  filePath: string,
  format: BookFormat,
  fallbackTitle?: string
): Promise<ExtractedMetadata> {
  const fallback: ExtractedMetadata = {
    title: fallbackTitle ?? path.basename(filePath, path.extname(filePath)),
  };

  try {
    switch (format) {
      case 'epub': return await extractEpubMetadata(filePath);
      case 'pdf': return await extractPdfMetadata(filePath);
      case 'cbz': {
        const meta = await extractCbzMetadata(filePath);
        return {
          ...meta,
          title: fallbackTitle ?? meta.title
        };
      }
      case 'cbr': {
        const meta = await extractCbrMetadata(filePath);
        return {
          ...meta,
          title: fallbackTitle ?? meta.title
        };
      }
      case 'images': return fallback;
      default: return fallback;
    }
  } catch {
    return fallback;
  }
}
