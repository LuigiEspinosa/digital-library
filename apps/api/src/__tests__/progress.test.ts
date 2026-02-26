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
    Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="file";
  filename="${filename}"${CRLF}Content-Type: application/octet-stream${CRLF}${CRLF}`),
    content,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('Reading progress routes', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userCookie: string;
  let libraryId: string;
  let bookId: string;
  let tmpBooks: string;
  let tmpCovers: string;

  beforeEach(async () => {
    tmpBooks = await mkdtemp(path.join(os.tmpdir(), 'dl-progress-books-'));
    tmpCovers = await mkdtemp(path.join(os.tmpdir(), 'dl-progress-covers-'));
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

    const { body, contentType } = makeMultipartBody('test.epub', Buffer.from('epub bytes'));
    const uploadRes = await app.inject({
      method: 'POST', url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      body,
    });
    bookId = uploadRes.json().book.id;
  });

  afterEach(async () => {
    await app.close();
    await rm(tmpBooks, { recursive: true, force: true });
    await rm(tmpCovers, { recursive: true, force: true });
    delete process.env.BOOKS_PATH;
    delete process.env.COVERS_PATH;
  });

  // ---- GET /books/:id/progress ----

  test('GET progress returns null when no position saved', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/books/${bookId}/progress`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().position).toBeNull();
  });

  test('GET progress returns 401 without session', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/books/${bookId}/progress`,
    });
    expect(res.statusCode).toBe(401);
  });

  test('GET progress returns 403 when user has no library access', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/books/${bookId}/progress`,
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  test('GET progress returns 404 for unknown book', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/books/nonexistent/progress',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  // ---- PUT /books/:id/progress ----

  test('PUT progress saves position and GET returns it', async () => {
    const cfi = 'epubcfi(/6/4[chap01]!/4/2/2/1:0)';

    const putRes = await app.inject({
      method: 'PUT', url: `/api/books/${bookId}/progress`,
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      payload: { position: cfi },
    });
    expect(putRes.statusCode).toBe(204);

    const getRes = await app.inject({
      method: 'GET', url: `/api/books/${bookId}/progress`,
      headers: { cookie: adminCookie },
    });
    expect(getRes.json().position).toBe(cfi);
  });

  test('PUT progress upserts -- second write overwrites first', async () => {
    const first = 'epubcfi(/6/4[chap01]!/4/2/2/1:0)';
    const second = 'epubcfi(/6/6[chap02]!/4/2/2/1:0)';

    for (const position of [first, second]) {
      await app.inject({
        method: 'PUT', url: `/api/books/${bookId}/progress`,
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        payload: { position },
      });
    }

    const res = await app.inject({
      method: 'GET', url: `/api/books/${bookId}/progress`,
      headers: { cookie: adminCookie },
    });
    expect(res.json().position).toBe(second);
  });

  test('PUT progress returns 400 when position is missing', async () => {
    const res = await app.inject({
      method: 'PUT', url: `/api/books/${bookId}/progress`,
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  test('PUT progress returns 401 without session', async () => {
    const res = await app.inject({
      method: 'PUT', url: `/api/books/${bookId}/progress`,
      headers: { 'content-type': 'application/json' },
      payload: { position: 'epubcfi(/6/4!/1:0)' },
    });
    expect(res.statusCode).toBe(401);
  });

  test('PUT progress returns 403 when user has no library access', async () => {
    const res = await app.inject({
      method: 'PUT', url: `/api/books/${bookId}/progress`,
      headers: { cookie: userCookie, 'content-type': 'application/json' },
      payload: { position: 'epubcfi(/6/4!/1:0)' },
    });
    expect(res.statusCode).toBe(403);
  });

  test('progress is scoped per user -- each user stores their own position', async () => {
    const nonAdmin = getDb(app).prepare('SELECT * FROM users WHERE is_admin = 0').get() as any;
    getDb(app).prepare('INSERT INTO user_libraries (user_id, library_id) VALUES (?, ?)').run(nonAdmin.id,
      libraryId);

    const adminCfi = 'epubcfi(/6/4[chap01]!/1:0)';
    const userCfi = 'epubcfi(/6/6[chap02]!/1:0)';

    await app.inject({
      method: 'PUT', url: `/api/books/${bookId}/progress`,
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      payload: { position: adminCfi },
    });
    await app.inject({
      method: 'PUT', url: `/api/books/${bookId}/progress`,
      headers: { cookie: userCookie, 'content-type': 'application/json' },
      payload: { position: userCfi },
    });

    const [adminRes, userRes] = await Promise.all([
      app.inject({ method: 'GET', url: `/api/books/${bookId}/progress`, headers: { cookie: adminCookie } }),
      app.inject({ method: 'GET', url: `/api/books/${bookId}/progress`, headers: { cookie: userCookie } }),
    ]);

    expect(adminRes.json().position).toBe(adminCfi);
    expect(userRes.json().position).toBe(userCfi);
  });
});
