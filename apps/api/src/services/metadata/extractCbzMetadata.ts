import path from "node:path";
import unzipper from 'unzipper';
import { ExtractedMetadata } from "../metadata.js";

const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;

export async function extractCbzMetadata(filePath: string): Promise<ExtractedMetadata> {
  const title = path.basename(filePath, path.extname(filePath));
  const dir = await unzipper.Open.file(filePath);

  // Sort entries so first page is deterministic (01.jpg < 02.jpg, etc.)
  const images = dir.files
    .filter(f => IMAGE_RE.test(f.path) && !f.path.startsWith('__MACOSX'))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

  if (images.length === 0) return { title };

  const cover_data = await images[0].buffer();
  const cover_ext = path.extname(images[0].path.slice(1).toLowerCase() || 'jpg');

  return { title, cover_data, cover_ext }
}
