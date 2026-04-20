import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDb } from '../db/connection.js';
import { runMigrations } from '../db/migration.js';
import { detectFormat, importBook } from '../services/importBook.js';

describe('detectFormat', () => {
  test.each([
    ['book.epub', 'epub'],
    ['document.pdf', 'pdf'],
    ['comic.cbz', 'cbz'],
    ['comic.cbr', 'cbr'],
    ['BOOK.EPUB', 'epub'], // case-insensitive
    ['COMIC.CBZ', 'cbz'],
  ])('%s → %s', (filename, expected) => {
    expect(detectFormat(filename)).toBe(expected);
  });

  test.each([['readme.txt'], ['archive.zip'], ['image.jpg'], ['noextension']])(
    '%s → null',
    (filename) => {
      expect(detectFormat(filename)).toBeNull();
    },
  );
});

describe('importBook', () => {
  let tmpBooks: string;
  let tmpCovers: string;
  let tmpSource: string;
  let db: ReturnType<typeof createDb>;
  const libraryId = 'test-library-id';

  beforeEach(async () => {
    tmpBooks = await mkdtemp(path.join(os.tmpdir(), 'dl-books-'));
    tmpCovers = await mkdtemp(path.join(os.tmpdir(), 'dl-covers-'));
    tmpSource = await mkdtemp(path.join(os.tmpdir(), 'dl-source-'));
    process.env.BOOKS_PATH = tmpBooks;
    process.env.COVERS_PATH = tmpCovers;

    db = createDb(':memory:');
    runMigrations(db);
    db.prepare('INSERT INTO libraries (id, name) VALUES (?, ?)').run(
      libraryId,
      'Test',
    );
  });

  afterEach(async () => {
    db.close();
    await rm(tmpBooks, { recursive: true, force: true });
    await rm(tmpCovers, { recursive: true, force: true });
    await rm(tmpSource, { recursive: true, force: true });
    delete process.env.BOOKS_PATH;
    delete process.env.COVERS_PATH;
  });

  test('imports a file and returns book record', async () => {
    const src = path.join(tmpSource, 'test.pdf');
    await writeFile(src, Buffer.from('fake pdf bytes'));

    const result = await importBook(db, libraryId, src, 'my-document.pdf');

    expect(result.duplicate).toBe(false);
    expect(result.book.format).toBe('pdf');
    expect(result.book.library_id).toBe(libraryId);
    expect(result.book.title).toBe('my-document'); // fallback from filename
    expect(result.book.file_size).toBeGreaterThan(0);
  });

  test('second import of identical content returns duplicate=true', async () => {
    const content = Buffer.from('identical file content');

    const src1 = path.join(tmpSource, 'book1.epub');
    await writeFile(src1, content);
    const first = await importBook(db, libraryId, src1, 'book.epub');
    expect(first.duplicate).toBe(false);

    // importBook moved src1 - write a new copy
    const src2 = path.join(tmpSource, 'book2.epub');
    await writeFile(src2, content);
    const second = await importBook(db, libraryId, src2, 'book-copy.epub');

    expect(second.duplicate).toBe(true);
    expect(second.book.id).toBe(first.book.id); // same book returned
  });

  test('throws on unsupported file extension', async () => {
    const src = path.join(tmpSource, 'readme.txt');
    await writeFile(src, Buffer.from('text'));

    await expect(importBook(db, libraryId, src, 'readme.txt')).rejects.toThrow(
      'Unsupported format',
    );
  });

  test('file is stored in BOOKS_PATH/libraryId/', async () => {
    const src = path.join(tmpSource, 'comic.cbz');
    await writeFile(src, Buffer.from('cbz content'));

    const result = await importBook(db, libraryId, src, 'comic.cbz');

    expect(result.book.file_path).toContain(libraryId);
    expect(result.book.file_path).toContain(tmpBooks);
    expect(result.book.file_path.endsWith('.cbz')).toBe(true);
  });

  // * Audit §3.1 - regression guard - sha256File() must stream, not buffer.
  // * The 200MB fixture is written in 1MB chunks via createWriteStream so the
  // * process itself never allocates the whole file. The .epub extension
  // * routes the metadata extractor trough unzipper, which throws on junk
  // * bytes and is caught by the fallback in services/metadata.ts - meaning
  // * the only code path that touces the full file is sha256File().
  // ! If you change the fixture extension to .pdf, this test will fail for the
  // ! wrong reason: extractPdfMetadata still readFile()s the while file.
  test('streaming SHA-256 keeps RSS growth under 50MB for a 200MB import', async () => {
    const src = path.join(tmpSource, 'large.epub');

    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(src);
      const chunk = Buffer.alloc(1024 * 1024, 0xab); // 1MB of constant bytes
      let written = 0;
      const pump = () => {
        let ok = true;
        while (written < 200 && ok) {
          ok = ws.write(chunk);
          written++;
        }
        if (written < 200) ws.once('drain', pump);
        else ws.end();
      };
      ws.on('finish', () => resolve());
      ws.on('error', reject);
      pump();
    });

    const rssBefore = process.memoryUsage().rss;
    const result = await importBook(db, libraryId, src, 'large.epub');
    const rssAfter = process.memoryUsage().rss;

    expect(result.duplicate).toBe(false);
    expect(result.book.format).toBe('epub');

    const growthMb = (rssAfter - rssBefore) / (1024 * 1024);
    // 50MB is the story's stated ceiling. Streaming uses 16KB internal
    // chunks, so real growth should be well under 5MB; the headroom absorbs
    // V8 and sharps/unzipper allocation noise.
    expect(growthMb).toBeLessThan(50);
  }, 60_000);
});
