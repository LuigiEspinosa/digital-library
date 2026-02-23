import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
    ['BOOK.EPUB', 'epub'],   // case-insensitive
    ['COMIC.CBZ', 'cbz'],
  ])('%s → %s', (filename, expected) => {
    expect(detectFormat(filename)).toBe(expected);
  });

  test.each([
    ['readme.txt'],
    ['archive.zip'],
    ['image.jpg'],
    ['noextension'],
  ])('%s → null', (filename) => {
    expect(detectFormat(filename)).toBeNull();
  });
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
    db.prepare('INSERT INTO libraries (id, name) VALUES (?, ?)').run(libraryId, 'Test');
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

    await expect(importBook(db, libraryId, src, 'readme.txt')).rejects.toThrow('Unsupported format');
  });

  test('file is stored in BOOKS_PATH/libraryId/', async () => {
    const src = path.join(tmpSource, 'comic.cbz');
    await writeFile(src, Buffer.from('cbz content'));

    const result = await importBook(db, libraryId, src, 'comic.cbz');

    expect(result.book.file_path).toContain(libraryId);
    expect(result.book.file_path).toContain(tmpBooks);
    expect(result.book.file_path.endsWith('.cbz')).toBe(true);
  });
});
