import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { build } from '../app.js';
import { UserRepository } from '../db/repositories/UserRepository.js';

function getDb(app: FastifyInstance) {
  return (app as any).db;
}

describe('Reading progress routes', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userCookie: string;
  let libraryId: string;
  let bookId: string;

  beforeEach(async () => {
    app = await build({ db: ':memory:', logger: false });
    const users = new UserRepository(getDb(app));
    await users.create({ email: 'admin@test.com', password: 'adminpass', is_admin: true });
    await users.create({ email: 'user@test.com', password: 'userpass' });

    const { nanoid } = await import('nanoid');
    libraryId = nanoid();
    bookId = nanoid();

    getDb(app)
      .prepare('INSERT INTO libraries (id, name) VALUES (?, ?)')
      .run(libraryId, 'Test Library');

    // Insert a minimal book row directly - progress routes only need it to exist
    getDb(app)
      .prepare(`INSERT INTO books (id, library_id, title, format, file_path, sha256, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(bookId, libraryId, 'Test Book', 'epub', '/data/books/test.epub', nanoid());

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

  afterEach(() => app.close());

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
