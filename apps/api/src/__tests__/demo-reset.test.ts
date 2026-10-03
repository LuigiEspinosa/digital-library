import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { build } from '../app';
import { DEMO_PRINCIPAL, grantAccess } from '../acl';
import { UserRepository } from '../db/repositories/UserRepository';
import { DEMO_BOOKS, DEMO_LIBRARY, demoPdf } from '../demo-fixture';
import { main, resetDemoScope, ResetRefused, type Roots } from '../demo-reset';
import { extractPdfMetadata } from '../services/metadata/extractPdfMetadata';

// `demo:reset` in digital-library (cuatro-portfolio Story 5.9, AD-13, the record
// ops/demo-principal.md § The reset there), against a real SQLite file and real
// directories: the Operator's library, books, files, covers and reading beside
// the demo scope's.

let dir: string;
let dbFile: string;
let roots: Roots;
let app: FastifyInstance;
let ids: { admin: string; reader: string; demo: string };

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function put(file: string, data: string | Buffer) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

/** Every row of every table but the full-text index, and every file under the data directory. */
function dump() {
  const tables = (app.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'books_fts%' ORDER BY name").all() as { name: string }[])
    .map((t) => t.name);
  const rows = Object.fromEntries(
    tables.map((t) => [t, (app.db.prepare(`SELECT * FROM ${t}`).all() as object[]).map((r) => JSON.stringify(r)).sort()]),
  );
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else files[path.relative(dir, p).split(path.sep).join('/')] = sha(readFileSync(p));
    }
  };
  walk(roots.books);
  walk(roots.covers);
  return { rows, files };
}

/** The dump without the demo scope: the fixture library, what it holds, and its covers. */
function operatorPart(d: ReturnType<typeof dump>) {
  const demoBooks = new Set(
    (app.db.prepare('SELECT id FROM books WHERE library_id = ?').all(DEMO_LIBRARY.id) as { id: string }[]).map((b) => b.id),
  );
  const rows = Object.fromEntries(
    Object.entries(d.rows).map(([t, rs]) => [
      t,
      rs.filter((r) => {
        const o = JSON.parse(r);
        return o.library_id !== DEMO_LIBRARY.id && o.id !== DEMO_LIBRARY.id && !demoBooks.has(o.book_id) && !(t === 'books' && o.library_id === DEMO_LIBRARY.id);
      }),
    ]),
  );
  const files = Object.fromEntries(
    Object.entries(d.files).filter(([p]) => !p.startsWith(`books/${DEMO_LIBRARY.id}/`) && !p.startsWith('covers/visitor')),
  );
  return { rows, files };
}

function expectFixture() {
  const library = app.db.prepare('SELECT * FROM libraries WHERE id = ?').get(DEMO_LIBRARY.id);
  expect(library).toEqual(DEMO_LIBRARY);
  expect(app.db.prepare('SELECT user_id FROM user_libraries WHERE library_id = ?').all(DEMO_LIBRARY.id)).toEqual([{ user_id: ids.demo }]);
  const books = app.db.prepare('SELECT * FROM books WHERE library_id = ? ORDER BY id').all(DEMO_LIBRARY.id) as Record<string, unknown>[];
  expect(books.map((b) => b.id)).toEqual(DEMO_BOOKS.map((b) => b.id));
  for (const [i, fixture] of DEMO_BOOKS.entries()) {
    const data = demoPdf(fixture.title, fixture.text);
    const file = path.join(roots.books, DEMO_LIBRARY.id, `${fixture.id}.pdf`);
    expect(books[i]).toMatchObject({
      title: fixture.title,
      author: fixture.author,
      format: 'pdf',
      file_path: file,
      cover_path: null,
      sha256: sha(data),
      file_size: data.length,
      created_at: fixture.created_at,
    });
    expect(readFileSync(file).equals(data)).toBe(true);
  }
  expect(readdirSync(path.join(roots.books, DEMO_LIBRARY.id)).sort()).toEqual(DEMO_BOOKS.map((b) => `${b.id}.pdf`));
  expect(app.db.prepare('SELECT count(*) AS n FROM reading_progress WHERE user_id = ?').get(ids.demo)).toEqual({ n: 0 });
}

/** The fixture library as an earlier reset leaves it, by hand, before any fixture book exists. */
function demoLibraryByHand() {
  app.db.prepare('INSERT INTO libraries (id, name) VALUES (?, ?)').run(DEMO_LIBRARY.id, DEMO_LIBRARY.name);
  grantAccess(app.db, ids.demo, DEMO_LIBRARY.id);
}

/** What a Visitor leaves: an upload with its cover, reading progress, a renamed library. */
async function visit() {
  const file = path.join(roots.books, DEMO_LIBRARY.id, 'visitor-book.epub');
  const cover = path.join(roots.covers, 'visitor-book.jpg');
  await put(file, 'uploaded by a Visitor');
  await put(cover, 'cover');
  app.db
    .prepare(`INSERT INTO books (id, library_id, title, format, file_path, cover_path, sha256) VALUES ('visitor-book', ?, 'Visitor upload', 'epub', ?, ?, 'visitor-sha')`)
    .run(DEMO_LIBRARY.id, file, cover);
  app.db.prepare(`INSERT INTO reading_progress (user_id, book_id, position) VALUES (?, 'visitor-book', '3')`).run(ids.demo);
  app.db.prepare(`UPDATE libraries SET name = 'Renamed by a Visitor' WHERE id = ?`).run(DEMO_LIBRARY.id);
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'dl-demo-reset-'));
  dbFile = path.join(dir, 'library.db');
  roots = { books: path.join(dir, 'books'), covers: path.join(dir, 'covers') };
  vi.stubEnv('DATA_DIR', dir);
  app = await build({ db: dbFile, logger: false });
  const users = new UserRepository(app.db);
  ids = {
    admin: (await users.create({ email: 'admin@test.com', password: 'adminpass', is_admin: true })).id,
    reader: (await users.create({ email: 'reader@test.com', password: 'readerpass' })).id,
    demo: (await users.create({ email: DEMO_PRINCIPAL, password: 'demopass' })).id,
  };
  // The Operator's library, a reader's grant, a book with its file and cover, and his reading.
  app.db.prepare(`INSERT INTO libraries (id, name) VALUES ('op-lib', 'Operator')`).run();
  grantAccess(app.db, ids.reader, 'op-lib');
  const opFile = path.join(roots.books, 'op-lib', 'op-book.epub');
  const opCover = path.join(roots.covers, 'op-book.jpg');
  await put(opFile, 'the Operator book');
  await put(opCover, 'the Operator cover');
  app.db
    .prepare(`INSERT INTO books (id, library_id, title, format, file_path, cover_path, sha256) VALUES ('op-book', 'op-lib', 'Operator book', 'epub', ?, ?, 'op-sha')`)
    .run(opFile, opCover);
  app.db.prepare(`INSERT INTO reading_progress (user_id, book_id, position) VALUES (?, 'op-book', '7')`).run(ids.admin);
  app.db.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES ('demo-session', ?, 9999999999)`).run(ids.demo);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

describe('the fixture', () => {
  test('has fixed ids and fixed times, and each file is a real one-page PDF', async () => {
    expect(DEMO_LIBRARY.id).toBe('demo-library');
    for (const book of DEMO_BOOKS) {
      expect(book.id).toMatch(/^demo-book-\d+$/);
      expect(book.created_at).toBe('2026-10-01 00:00:00');
      expect(demoPdf(book.title, book.text).equals(demoPdf(book.title, book.text))).toBe(true);
    }
    const file = path.join(dir, 'probe.pdf');
    await writeFile(file, demoPdf(DEMO_BOOKS[0].title, DEMO_BOOKS[0].text));
    expect((await extractPdfMetadata(file)).page_count).toBe(1);
  });
});

/**
 * Every table the migration writes, classified (the record's § The reset item 3). `reset`: deleted with the
 * fixture library by its cascade. `principal`: the accounts, of which the reset writes none. `structural`: the
 * full-text index, which the triggers on `books` keep. A new table fails the case below until it is classified,
 * so Visitor state in a table the reset does not reach cannot outlive a reset unnoticed.
 */
const TABLES: Record<string, 'reset' | 'principal' | 'structural'> = {
  libraries: 'reset',
  user_libraries: 'reset',
  books: 'reset',
  reading_progress: 'reset',
  users: 'principal',
  sessions: 'principal',
  books_fts: 'structural',
  books_fts_config: 'structural',
  books_fts_data: 'structural',
  books_fts_docsize: 'structural',
  books_fts_idx: 'structural',
};

describe('the scope', () => {
  test('classifies every table, and each reset table reaches libraries by ON DELETE CASCADE', () => {
    const tables = (app.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[])
      .map((t) => t.name);
    expect(tables).toEqual(Object.keys(TABLES).sort());
    const reaches = (table: string, seen = new Set<string>()): boolean =>
      table === 'libraries' ||
      (!seen.has(table) &&
        (app.db.prepare('SELECT "table", on_delete FROM pragma_foreign_key_list(?)').all(table) as { table: string; on_delete: string }[])
          .some((fk) => fk.on_delete === 'CASCADE' && reaches(fk.table, seen.add(table))));
    for (const [table, kind] of Object.entries(TABLES)) if (kind === 'reset') expect(reaches(table), table).toBe(true);
  });
});

describe('the reset', () => {
  test('empties the demo scope to the fixture twice over, the second run changing nothing, and never touches the Operator', async () => {
    const operatorBefore = operatorPart(dump());
    expect(await resetDemoScope(app.db, roots)).toEqual({ status: 'reset', rows: 2 + DEMO_BOOKS.length });
    expectFixture();
    await visit();

    expect(await resetDemoScope(app.db, roots)).toEqual({ status: 'reset', rows: 2 + DEMO_BOOKS.length });
    expect(operatorPart(dump())).toEqual(operatorBefore);
    expectFixture();
    expect(existsSync(path.join(roots.covers, 'visitor-book.jpg'))).toBe(false);
    const first = dump();

    expect(await resetDemoScope(app.db, roots)).toEqual({ status: 'reset', rows: 2 + DEMO_BOOKS.length });
    expect(dump()).toEqual(first);
  });

  test('keeps the demo principal, its credentials and its sessions', async () => {
    const before = app.db.prepare('SELECT * FROM users WHERE id = ?').get(ids.demo);
    await resetDemoScope(app.db, roots);
    await visit();
    await resetDemoScope(app.db, roots);
    expect(app.db.prepare('SELECT * FROM users WHERE id = ?').get(ids.demo)).toEqual(before);
    expect(app.db.prepare('SELECT id FROM sessions WHERE user_id = ?').all(ids.demo)).toEqual([{ id: 'demo-session' }]);
  });

  test('answers skipped and changes nothing without a demo principal account', async () => {
    app.db.prepare('DELETE FROM users WHERE id = ?').run(ids.demo);
    const before = dump();
    expect(await resetDemoScope(app.db, roots)).toEqual({ status: 'skipped', reason: 'the demo principal is absent' });
    expect(dump()).toEqual(before);
  });

  test('refuses, changing nothing, when the demo scope holds a library it did not create', async () => {
    await resetDemoScope(app.db, roots);
    await visit();
    app.db.prepare(`INSERT INTO libraries (id, name) VALUES ('granted', 'Granted by an admin')`).run();
    grantAccess(app.db, ids.demo, 'granted');
    const before = dump();
    await expect(resetDemoScope(app.db, roots)).rejects.toThrow(ResetRefused);
    expect(dump()).toEqual(before);
  });

  test("the admin's container routes remain the way out of a refusal: deleting the granted library lets the reset run", async () => {
    await resetDemoScope(app.db, roots);
    app.db.prepare(`INSERT INTO libraries (id, name) VALUES ('granted', 'Granted by an admin')`).run();
    grantAccess(app.db, ids.demo, 'granted');
    await expect(resetDemoScope(app.db, roots)).rejects.toThrow(ResetRefused);

    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@test.com', password: 'adminpass' } });
    const cookie = login.headers['set-cookie'] as string;
    const listed = (await app.inject({ method: 'GET', url: '/api/admin/libraries', headers: { cookie } })).json().libraries.map((l: { id: string }) => l.id);
    expect(listed).toEqual(expect.arrayContaining(['granted', DEMO_LIBRARY.id]));
    expect((await app.inject({ method: 'DELETE', url: '/api/admin/libraries/granted', headers: { cookie } })).statusCode).toBe(204);

    expect(await resetDemoScope(app.db, roots)).toEqual({ status: 'reset', rows: 2 + DEMO_BOOKS.length });
    expectFixture();
  });

  test('refuses when the fixture library exists outside the demo scope', async () => {
    app.db.prepare('INSERT INTO libraries (id, name) VALUES (?, ?)').run(DEMO_LIBRARY.id, 'Somebody else');
    grantAccess(app.db, ids.reader, DEMO_LIBRARY.id);
    const before = dump();
    await expect(resetDemoScope(app.db, roots)).rejects.toThrow(ResetRefused);
    expect(dump()).toEqual(before);
  });

  test('applies nothing when the reseed fails part way', async () => {
    demoLibraryByHand();
    await visit();
    // An Operator book holding a fixture file's digest: the reseed's insert fails on the unique sha256.
    const data = demoPdf(DEMO_BOOKS[2].title, DEMO_BOOKS[2].text);
    app.db.prepare('UPDATE books SET sha256 = ? WHERE id = ?').run(sha(data), 'op-book');
    const before = dump();
    await expect(resetDemoScope(app.db, roots)).rejects.toThrow(/UNIQUE/);
    expect(dump()).toEqual(before);
  });

  test('removes no cover outside the covers directory, whatever a row names', async () => {
    await resetDemoScope(app.db, roots);
    const outside = path.join(dir, 'elsewhere.jpg');
    await put(outside, 'not the scope');
    app.db
      .prepare(`INSERT INTO books (id, library_id, title, format, file_path, cover_path, sha256) VALUES ('odd', ?, 'Odd', 'pdf', 'x', ?, 'odd-sha')`)
      .run(DEMO_LIBRARY.id, outside);
    await resetDemoScope(app.db, roots);
    expect(existsSync(outside)).toBe(true);
  });
});

describe('the command', () => {
  const capture = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, streams: [{ write: (s: string) => out.push(s) }, { write: (s: string) => err.push(s) }] as const };
  };

  test('prints one reset line and exits 0', async () => {
    vi.stubEnv('DATABASE_PATH', dbFile);
    vi.stubEnv('BOOKS_PATH', roots.books);
    vi.stubEnv('COVERS_PATH', roots.covers);
    const { out, err, streams } = capture();
    expect(await main(...streams)).toBe(0);
    expect(out).toEqual([`demo:reset digital-library reset rows=${2 + DEMO_BOOKS.length}\n`]);
    expect(err).toEqual([]);
    expectFixture();
  });

  test('prints one skipped line and exits 0 without a demo principal account', async () => {
    app.db.prepare('DELETE FROM users WHERE id = ?').run(ids.demo);
    vi.stubEnv('DATABASE_PATH', dbFile);
    const { out, streams } = capture();
    expect(await main(...streams)).toBe(0);
    expect(out).toEqual(['demo:reset digital-library skipped: the demo principal is absent\n']);
  });

  test('prints one failed line, quoting no row, exits 1, and creates no database where there is none', async () => {
    const missing = path.join(dir, 'missing.db');
    vi.stubEnv('DATABASE_PATH', missing);
    const { out, err, streams } = capture();
    expect(await main(...streams)).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual(['demo:reset digital-library failed: no database at DATABASE_PATH\n']);
    expect(existsSync(missing)).toBe(false);
  });

  test('names a driver fault by its class and code only', async () => {
    const data = demoPdf(DEMO_BOOKS[0].title, DEMO_BOOKS[0].text);
    app.db.prepare('UPDATE books SET sha256 = ? WHERE id = ?').run(sha(data), 'op-book');
    vi.stubEnv('DATABASE_PATH', dbFile);
    vi.stubEnv('BOOKS_PATH', roots.books);
    vi.stubEnv('COVERS_PATH', roots.covers);
    const { err, streams } = capture();
    expect(await main(...streams)).toBe(1);
    expect(err).toEqual(['demo:reset digital-library failed: SqliteError SQLITE_CONSTRAINT_UNIQUE\n']);
  });
});
