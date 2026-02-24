import { createHash } from "node:crypto";
import { mkdir, rename, copyFile, unlink, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Db } from "../db/connection.js";
import { BookRepository } from "../db/repositories/BookRepository.js";
import { extractMetadata } from "./metadata.js";
import type { Book, BookFormat } from "@digital-library/shared";

const booksRoot = () => process.env.BOOKS_PATH ?? '/data/books';
const coversRoot = () => process.env.COVERS_PATH ?? '/data/covers';

const FORMAT_MAP: Record<string, BookFormat> = {
  epub: 'epub',
  pdf: 'pdf',
  cbz: 'cbz',
  cbr: 'cbr',
};

export function detectFormat(filename: string): BookFormat | null {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return FORMAT_MAP[ext] ?? null;
}

async function sha256File(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

async function moveFile(src: string, dest: string): Promise<void> {
  try {
    await rename(src, dest);
  } catch (err: any) {
    if (err.code !== 'EXDEV') throw err;
    await copyFile(src, dest);
    await unlink(src);
  }
}

async function generateCover(
  bookId: string,
  coverData: Buffer,
): Promise<string> {
  await mkdir(coversRoot(), { recursive: true });
  const outPath = path.join(coversRoot(), `${bookId}.jpg`);

  await sharp(coverData)
    .resize(300, 450, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 85 })
    .toFile(outPath);

  return outPath;
}

export interface ImportResult {
  book: Book,
  duplicate: boolean;
}

/**
 * Core import pipeline, called by both the upload route and the chokidar watcher.
 * `sourcePath` must be a fully-written file on disk (temp upload or inbox file).
 */
export async function importBook(
  db: Db,
  libraryId: string,
  sourcePath: string,
  originalFilename: string
): Promise<ImportResult> {
  const format = detectFormat(originalFilename);
  if (!format) throw new Error(`Unsupported format: ${path.extname(originalFilename)}`);

  // 1. SHA-256 deduplication
  const sha256 = await sha256File(sourcePath);
  const repo = new BookRepository(db);

  const existing = repo.findBySha256(sha256);
  if (existing) return { book: existing, duplicate: true };

  // 2. Move file to final storage location
  const { nanoid } = await import('nanoid');
  const id = nanoid();
  const ext = path.extname(originalFilename).toLowerCase();
  const destDir = path.join(booksRoot(), libraryId);
  await mkdir(destDir, { recursive: true });
  const destPath = path.join(destDir, `${id}${ext}`);

  /**
   * `rename()` is atomic on the same filesystem (temp -> `/data/books/`).
   * No risk of a partial file being served. If temp and destination are on
   * different filesystems (e.g. a Docker bind mount boundary), `rename` will throw `EXDEV`.
   */
  await moveFile(sourcePath, destPath);

  // 3. Extract metadata
  const fileStats = await stat(destPath);
  const meta = await extractMetadata(destPath, format, path.basename(originalFilename, ext));

  // 4. Generate cover thumbnail
  let cover_path: string | undefined;
  if (meta.cover_data) {
    try {
      cover_path = await generateCover(id, meta.cover_data);
    } catch {
      // cover generation failure is non-fatal
    }
  }

  // 5. Persist to DB
  const book = repo.create({
    library_id: libraryId,
    title: meta.title,
    author: meta.author,
    format,
    file_path: destPath,
    cover_path,
    description: meta.description,
    isbn: meta.isbn,
    published_at: meta.published_at,
    page_count: meta.page_count,
    file_size: fileStats.size,
    language: meta.language,
    sha256,
  });

  return { book, duplicate: false }
}
