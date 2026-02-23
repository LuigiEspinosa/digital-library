import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { FastifyInstance } from 'fastify';
import { build } from '../app.js';
import { UserRepository } from '../db/repositories/UserRepository.js';

function getDb(app: FastifyInstance) {
  return (app as any).db;
}

function makeMultipartBody(filename: string, content: Buffer) {
  const boundary = 'TestBoundary' + Date.now();
  const CRLF = '\r\n';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: application/octet-stream${CRLF}${CRLF}`),
    content,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('Book routes', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userCookie: string;
  let libraryId: string;
  let tmpBooks: string;
  let tmpCovers: string;

  beforeEach(async () => {
    // Redirect file I/O to temp dirs so tests don't touch /data
    tmpBooks = await mkdtemp(path.join(os.tmpdir(), 'dl-test-books-'));
    tmpCovers = await mkdtemp(path.join(os.tmpdir(), 'dl-test-covers-'));
    process.env.BOOKS_PATH = tmpBooks;
    process.env.COVERS_PATH = tmpCovers;

    app = await build({ db: ':memory:', logger: false });
    const users = new UserRepository(getDb(app));
    await users.create({ email: 'admin@test.com', password: 'adminpass', is_admin: true });
    await users.create({ email: 'user@test.com', password: 'userpass' });

    const { nanoid } = await import('nanoid');
    libraryId = nanoid();
    getDb(app).prepare('INSERT INTO libraries (id, name) VALUES (?, ?)').run(libraryId, 'Test Library');

    const adminLogin = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'adminpass' },
    });
    adminCookie = adminLogin.headers['set-cookie'] as string;

    const userLogin = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'user@test.com', password: 'userpass' },
    });
    userCookie = userLogin.headers['set-cookie'] as string;
  });

  afterEach(async () => {
    await app.close();
    await rm(tmpBooks, { recursive: true, force: true });
    await rm(tmpCovers, { recursive: true, force: true });
    delete process.env.BOOKS_PATH;
    delete process.env.COVERS_PATH;
  });

  // ---- Upload ----

  test('POST upload returns 201 with book record', async () => {
    const { body, contentType } = makeMultipartBody('my-book.epub', Buffer.from('fake epub bytes'));

    const res = await app.inject({
      method: 'POST',
      url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });

    expect(res.statusCode).toBe(201);
    const { book } = res.json();
    expect(book.title).toBe('my-book'); // fallback title from filename
    expect(book.format).toBe('epub');
    expect(book.library_id).toBe(libraryId);
  });

  test('POST upload returns 409 for duplicate file', async () => {
    const content = Buffer.from('identical content sha256');
    const { body: b1, contentType: ct1 } = makeMultipartBody('book.epub', content);
    const { body: b2, contentType: ct2 } = makeMultipartBody('book.epub', content);

    await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': ct1 },
      body: b1,
    });

    const res = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': ct2 },
      body: b2,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().book).toBeDefined(); // existing book returned
  });

  test('POST upload returns 415 for unsupported format', async () => {
    const { body, contentType } = makeMultipartBody('readme.txt', Buffer.from('text file'));

    const res = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });

    expect(res.statusCode).toBe(415);
  });

  test('POST upload returns 400 when no file included', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': 'multipart/form-data; boundary=empty' },
      body: Buffer.from('--empty--\r\n'),
    });

    expect(res.statusCode).toBe(400);
  });

  test('POST upload returns 403 when user has no library access', async () => {
    const { body, contentType } = makeMultipartBody('book.epub', Buffer.from('content'));

    const res = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: userCookie, 'content-type': contentType },
      body,
    });

    expect(res.statusCode).toBe(403);
  });

  test('POST upload returns 401 when not authenticated', async () => {
    const { body, contentType } = makeMultipartBody('book.epub', Buffer.from('content'));

    const res = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { 'content-type': contentType },
      body,
    });

    expect(res.statusCode).toBe(401);
  });

  // ---- GET /books ----

  test('GET /books returns empty list when no books', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/books',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ data: [], total: 0 });
  });

  test('GET /books returns uploaded books for admin', async () => {
    const { body, contentType } = makeMultipartBody('book.pdf', Buffer.from('pdf bytes'));
    await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });

    const res = await app.inject({
      method: 'GET', url: '/api/books',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].format).toBe('pdf');
  });

  test('GET /books returns only accessible books for regular user', async () => {
    // Upload a book as admin
    const { body, contentType } = makeMultipartBody('book.epub', Buffer.from('bytes'));
    await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });

    // User without access gets empty list
    const res = await app.inject({
      method: 'GET', url: '/api/books',
      headers: { cookie: userCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(0);
  });

  // ---- GET /books/:id ----

  test('GET /books/:id returns 404 for unknown book', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/books/nonexistent',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  test('GET /books/:id returns 403 when user has no library access', async () => {
    const { body, contentType } = makeMultipartBody('book.cbz', Buffer.from('cbz bytes'));
    const uploadRes = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });
    const bookId = uploadRes.json().book.id;

    const res = await app.inject({
      method: 'GET', url: `/api/books/${bookId}`,
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  test('GET /books/:id returns book when user has access', async () => {
    const { body, contentType } = makeMultipartBody('comic.cbz', Buffer.from('cbz bytes'));
    const uploadRes = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });
    const bookId = uploadRes.json().book.id;

    // Grant access and re-login
    const all = getDb(app).prepare('SELECT * FROM users WHERE is_admin = 0').get() as any;
    getDb(app).prepare('INSERT INTO user_libraries (user_id, library_id) VALUES (?, ?)').run(all.id, libraryId);

    const res = await app.inject({
      method: 'GET', url: `/api/books/${bookId}`,
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().book.id).toBe(bookId);
  });

  // ---- GET /libraries/:id/books ----

  test('GET /libraries/:id/books returns books in library', async () => {
    const { body, contentType } = makeMultipartBody('book1.epub', Buffer.from('epub 1'));
    await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });

    const res = await app.inject({
      method: 'GET', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
  });

  test('GET /libraries/:id/books returns 403 without access', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  // ---- DELETE /books/:id ----

  test('DELETE /books/:id returns 204 for admin', async () => {
    const { body, contentType } = makeMultipartBody('todelete.epub', Buffer.from('content'));
    const uploadRes = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });
    const bookId = uploadRes.json().book.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/books/${bookId}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(204);
  });

  test('DELETE /books/:id returns 403 for non-admin', async () => {
    const { body, contentType } = makeMultipartBody('book.epub', Buffer.from('content'));
    const uploadRes = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });
    const bookId = uploadRes.json().book.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/books/${bookId}`,
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});
