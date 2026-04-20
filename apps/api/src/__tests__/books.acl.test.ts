import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { FastifyInstance } from 'fastify';
import { build } from '../app';
import { UserRepository } from '../db/repositories/UserRepository';

function makeMultipartBody(filename: string, content: Buffer) {
  const boundary = 'TestBoundary' + Date.now();
  const CRLF = '\r\n';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: application/octet-stream${CRLF}${CRLF}`,
    ),
    content,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('GET /api/books/:id/file - ACL', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userCookie: string;
  let libraryId: string;
  let bookId: string;
  let tmpBooks: string;
  let tmpCovers: string;

  beforeEach(async () => {
    tmpBooks = await mkdtemp(path.join(os.tmpdir(), 'dl-test-books-'));
    tmpCovers = await mkdtemp(path.join(os.tmpdir(), 'dl-test-covers-'));
    process.env.BOOKS_PATH = tmpBooks;
    process.env.COVERS_PATH = tmpCovers;

    app = await build({ db: ':memory:', logger: false });

    const users = new UserRepository(app.db);

    await users.create({ email: 'admin@test.com', password: 'adminpass', is_admin: true });
    await users.create({ email: 'user@test.com', password: 'userpass' });

    const { nanoid } = await import('nanoid');
    libraryId = nanoid();
    app.db.prepare('INSERT INTO libraries (id, name) VALUES (?, ?)').run(libraryId, 'Test Library');

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'adminpass' },
    });
    adminCookie = adminLogin.headers['set-cookie'] as string;

    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@test.com', password: 'userpass' },
    });
    userCookie = userLogin.headers['set-cookie'] as string;

    const { body, contentType } = makeMultipartBody('acl-target.epub', Buffer.from('epub bytes for acl test'));
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/libraries/${libraryId}/books`,
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

  // ! If this test ever return 200, the `preHandler: requireAuth` was removed
  // ! from the `/books/:id/file` route registration in `routes/books.ts`.
  // ! That is a phase-2 regression - restore the middleware, do not relax the test.
  test('unauthenticated request returns 401 (not 200, not a file stream)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${bookId}/file`,
      // No cookie header
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
    });
  });

  test('authenticated user without library access returns 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${bookId}/file`,
      headers: { cookie: userCookie },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      statusCode: 403,
      error: 'Forbidden',
    });
  });

  test('authenticated user with library access returns 200 and the file stream', async () => {
    const userRow = app.db.prepare('SELECT id FROM users WHERE email = ?').get('user@test.com') as { id: string };
    app.db.prepare('INSERT INTO user_libraries (user_id, library_id) VALUES (?, ?)').run(userRow.id, libraryId);

    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${bookId}/file`,
      headers: { cookie: userCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/epub+zip');
    expect(res.rawPayload.toString()).toBe('epub bytes for acl test');
  });
});
