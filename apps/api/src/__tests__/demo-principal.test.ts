import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { build } from '../app';
import { UserRepository } from '../db/repositories/UserRepository';
import { DEMO_PRINCIPAL, getAllowedLibraryIds, grantAccess, hasAccess, inDemoScope, isDemoPrincipal, revokeAccess, ScopeError } from '../acl';

// The demo principal contract in digital-library (cuatro-portfolio Story 5.8,
// AD-13, ops/demo-principal.md there): its ownership scope is the libraries it
// holds, and neither it nor the Operator ever reaches across that boundary.

let app: FastifyInstance;
let ids: { admin: string; reader: string; demo: string };
let cookies: { admin: string; reader: string; demo: string };
let libs: { operator: string; demo: string };
let books: { operator: string; demo: string };

async function login(email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  expect(res.statusCode).toBe(200);
  return res.headers['set-cookie'] as string;
}

function library(name: string) {
  const id = nanoid();
  app.db.prepare('INSERT INTO libraries (id, name) VALUES (?, ?)').run(id, name);
  return id;
}

function book(libraryId: string) {
  const id = nanoid();
  app.db
    .prepare(`INSERT INTO books (id, library_id, title, format, file_path, sha256, created_at)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(id, libraryId, `Book ${id}`, 'epub', `/data/books/${id}.epub`, nanoid());
  return id;
}

beforeEach(async () => {
  app = await build({ db: ':memory:', logger: false });
  const users = new UserRepository(app.db);
  ids = {
    admin: (await users.create({ email: 'admin@test.com', password: 'adminpass', is_admin: true })).id,
    reader: (await users.create({ email: 'reader@test.com', password: 'readerpass' })).id,
    demo: (await users.create({ email: DEMO_PRINCIPAL, password: 'demopass' })).id,
  };
  libs = { operator: library('Operator'), demo: library('Demo') };
  books = { operator: book(libs.operator), demo: book(libs.demo) };
  grantAccess(app.db, ids.reader, libs.operator);
  grantAccess(app.db, ids.demo, libs.demo);
  cookies = {
    admin: await login('admin@test.com', 'adminpass'),
    reader: await login('reader@test.com', 'readerpass'),
    demo: await login(DEMO_PRINCIPAL, 'demopass'),
  };
});

afterEach(() => app.close());

describe('the principal', () => {
  test('is the contract address, recognised trimmed and in any case, and nothing else', () => {
    expect(DEMO_PRINCIPAL).toBe('demo@cuatro.dev');
    expect(isDemoPrincipal(' Demo@Cuatro.dev ')).toBe(true);
    for (const other of ['admin@test.com', 'demo@cuatro.dev.evil.test', '', null, undefined]) {
      expect(isDemoPrincipal(other)).toBe(false);
    }
  });
});

describe('ownership scopes', () => {
  test('the demo scope is the libraries the demo principal holds', () => {
    expect(inDemoScope(app.db, libs.demo)).toBe(true);
    expect(inDemoScope(app.db, libs.operator)).toBe(false);
    expect(getAllowedLibraryIds(app.db, ids.demo, false)).toEqual([libs.demo]);
    expect(getAllowedLibraryIds(app.db, ids.admin, true)).toEqual([libs.operator]);
  });

  test('no one, an admin included, reaches across the boundary', () => {
    expect(hasAccess(app.db, ids.admin, libs.demo, true)).toBe(false);
    expect(hasAccess(app.db, ids.reader, libs.demo, false)).toBe(false);
    expect(hasAccess(app.db, ids.demo, libs.operator, false)).toBe(false);
    expect(hasAccess(app.db, ids.demo, libs.demo, false)).toBe(true);
    expect(hasAccess(app.db, ids.admin, libs.operator, true)).toBe(true);
  });

  test('a demo library cannot be granted to anyone else, nor an Operator library to the demo principal', () => {
    expect(() => grantAccess(app.db, ids.reader, libs.demo)).toThrow(ScopeError);
    expect(() => grantAccess(app.db, ids.admin, libs.demo)).toThrow(ScopeError);
    expect(() => grantAccess(app.db, ids.demo, libs.operator)).toThrow(ScopeError);

    // A library only the Operator has read in cannot enter the demo scope either.
    const read = library('Read by the Operator');
    const readBook = book(read);
    app.db.prepare('INSERT INTO reading_progress (user_id, book_id, position) VALUES (?, ?, ?)').run(ids.admin, readBook, '1');
    expect(() => grantAccess(app.db, ids.demo, read)).toThrow(ScopeError);

    // An untouched one can, and then belongs to it alone.
    const fresh = library('Fresh');
    grantAccess(app.db, ids.demo, fresh);
    expect(inDemoScope(app.db, fresh)).toBe(true);

    // And it never leaves the scope still holding what the demo principal wrote: only deletion ends it.
    expect(() => revokeAccess(app.db, ids.demo, fresh)).toThrow(ScopeError);
    revokeAccess(app.db, ids.reader, libs.operator);
    expect(hasAccess(app.db, ids.reader, libs.operator, false)).toBe(false);
  });

  test('over HTTP: the admin grant answers 409, and neither side reads, writes or deletes across', async () => {
    const grant = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${ids.reader}/libraries/${libs.demo}`,
      headers: { cookie: cookies.admin },
    });
    expect(grant.statusCode).toBe(409);
    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${ids.demo}/libraries/${libs.demo}`,
      headers: { cookie: cookies.admin },
    });
    expect(revoke.statusCode).toBe(409);
    expect(inDemoScope(app.db, libs.demo)).toBe(true);

    const listed = async (cookie: string) =>
      (await app.inject({ method: 'GET', url: '/api/libraries', headers: { cookie } })).json().data.map((l: { id: string }) => l.id);
    expect(await listed(cookies.admin)).toEqual([libs.operator]);
    expect(await listed(cookies.demo)).toEqual([libs.demo]);

    for (const [cookie, id] of [
      [cookies.admin, books.demo],
      [cookies.demo, books.operator],
    ]) {
      const read = await app.inject({ method: 'GET', url: `/api/books/${id}`, headers: { cookie } });
      expect(read.statusCode).toBe(403);
      const progress = await app.inject({
        method: 'PUT',
        url: `/api/books/${id}/progress`,
        headers: { cookie },
        payload: { position: '1' },
      });
      expect(progress.statusCode).toBe(403);
    }

    const removed = await app.inject({ method: 'DELETE', url: `/api/books/${books.demo}`, headers: { cookie: cookies.admin } });
    expect(removed.statusCode).toBe(404);
    expect(app.db.prepare('SELECT 1 FROM books WHERE id = ?').get(books.demo)).toBeDefined();

    const own = await app.inject({ method: 'GET', url: `/api/books/${books.demo}`, headers: { cookie: cookies.demo } });
    expect(own.statusCode).toBe(200);
  });
});

describe('the principal cannot be deleted, made an admin, or have its credentials changed from inside the application', () => {
  test('deleting it answers 403 and it remains, through the route and the repository', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/users/${ids.demo}`, headers: { cookie: cookies.admin } });
    expect(res.statusCode).toBe(403);
    expect(() => new UserRepository(app.db).delete(ids.demo)).toThrow('cannot be deleted');
    expect(new UserRepository(app.db).findById(ids.demo)).not.toBeNull();

    // Anyone else is deleted as before.
    const other = await app.inject({ method: 'DELETE', url: `/api/admin/users/${ids.reader}`, headers: { cookie: cookies.admin } });
    expect(other.statusCode).toBe(204);
  });

  test('it is never created an admin', async () => {
    await expect(new UserRepository(app.db).create({ email: ' DEMO@cuatro.dev', password: 'x', is_admin: true })).rejects.toThrow('cannot be an admin');
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: cookies.admin },
      payload: { email: DEMO_PRINCIPAL, password: 'longenough', is_admin: true },
    });
    expect(res.statusCode).toBe(400);
  });

  test('no source writes a password or an email after the account is created', () => {
    const root = path.join(__dirname, '..');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) return name === '__tests__' ? [] : files(p);
        return p.endsWith('.ts') ? [p] : [];
      });
    const offenders = files(root).filter((p) => /UPDATE\s+users\b/i.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('without a demo principal account, nothing changes', () => {
  test('the admin reaches every library and grants as before', async () => {
    const users = new UserRepository(app.db);
    app.db.prepare('DELETE FROM users WHERE id = ?').run(ids.demo);
    expect(inDemoScope(app.db, libs.demo)).toBe(false);
    expect(hasAccess(app.db, ids.admin, libs.demo, true)).toBe(true);
    expect(getAllowedLibraryIds(app.db, ids.admin, true).sort()).toEqual([libs.operator, libs.demo].sort());
    grantAccess(app.db, ids.reader, libs.demo);
    expect(hasAccess(app.db, ids.reader, libs.demo, false)).toBe(true);
    expect(users.findById(ids.demo)).toBeNull();
  });
});

// Ruling DR4 (cuatro-portfolio ops/demo-principal.md, DW-333): every Visitor shares
// the demo principal, so it adds no file. POST /api/libraries/:libraryId/books is
// the one route that stores a file (covers are made inside it; the inbox watcher
// takes no request), and it refuses the demo principal before reading the body.
describe('the principal never uploads', () => {
  let storage: string;

  function multipart(filename: string, content: Buffer) {
    const boundary = 'DemoBoundary';
    return {
      body: Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
        content,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  }

  function upload(cookie: string, libraryId: string, content: Buffer) {
    const { body, contentType } = multipart('upload.epub', content);
    return app.inject({
      method: 'POST',
      url: `/api/libraries/${libraryId}/books`,
      headers: { cookie, 'content-type': contentType },
      body,
    });
  }

  const stored = () => readdirSync(storage, { recursive: true }).length;
  const rows = () => (app.db.prepare('SELECT COUNT(*) AS n FROM books').get() as { n: number }).n;

  beforeEach(() => {
    storage = mkdtempSync(path.join(tmpdir(), 'dl-demo-upload-'));
    mkdirSync(path.join(storage, 'books'));
    mkdirSync(path.join(storage, 'covers'));
    process.env.BOOKS_PATH = path.join(storage, 'books');
    process.env.COVERS_PATH = path.join(storage, 'covers');
  });

  afterEach(() => {
    delete process.env.BOOKS_PATH;
    delete process.env.COVERS_PATH;
    rmSync(storage, { recursive: true, force: true });
  });

  test('an upload to its own library answers 403 and writes nothing to disk or the database', async () => {
    const before = { rows: rows(), stored: stored() };
    const res = await upload(cookies.demo, libs.demo, Buffer.from('a Visitor file'));
    expect(res.statusCode).toBe(403);
    expect({ rows: rows(), stored: stored() }).toEqual(before);
    expect(app.db.prepare('SELECT 1 FROM books WHERE library_id = ? AND id <> ?').get(libs.demo, books.demo)).toBeUndefined();
  });

  test('it is refused before the body is read: a request with no file answers 403, not 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/libraries/${libs.demo}/books`,
      headers: { cookie: cookies.demo, 'content-type': 'multipart/form-data; boundary=empty' },
    });
    expect(res.statusCode).toBe(403);
    const other = await app.inject({
      method: 'POST',
      url: `/api/libraries/${libs.operator}/books`,
      headers: { cookie: cookies.reader, 'content-type': 'multipart/form-data; boundary=empty' },
    });
    expect(other.statusCode).toBe(400);
  });

  test("a file the Operator holds answers 403 without the Operator's book row (DW-334)", async () => {
    const content = Buffer.from('a file the Operator holds');
    const own = await upload(cookies.admin, libs.operator, content);
    expect(own.statusCode).toBe(201);
    const held = own.json().book;

    const res = await upload(cookies.demo, libs.demo, content);
    expect(res.statusCode).toBe(403);
    expect(res.json().book).toBeUndefined();
    expect(res.body).not.toContain(held.id);
    expect(res.body).not.toContain(libs.operator);
  });

  test('the Operator and every other user upload as before', async () => {
    const admin = await upload(cookies.admin, libs.operator, Buffer.from('the Operator file'));
    expect(admin.statusCode).toBe(201);
    expect(admin.json().book.library_id).toBe(libs.operator);
    expect(readFileSync(admin.json().book.file_path, 'utf8')).toBe('the Operator file');

    const reader = await upload(cookies.reader, libs.operator, Buffer.from('a reader file'));
    expect(reader.statusCode).toBe(201);
    expect(rows()).toBe(4);
  });
});
