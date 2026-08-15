import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { build } from '../app.js';
import { UserRepository } from '../db/repositories/UserRepository.js';
import { mkdir, rm } from 'node:fs/promises';

// Prevent tests from touching real disk.
// admin/libraries.ts imports these; the mock is hoisted before module load.
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

function getDb(app: FastifyInstance) {
  return (app as any).db;
}

function insertLibrary(app: FastifyInstance, name: string, description?: string): string {
  const id = crypto.randomUUID();
  getDb(app)
    .prepare('INSERT INTO libraries (id, name, description) VALUES (?, ?, ?)')
    .run(id, name, description ?? null);
  return id;
}

function insertBook(
  app: FastifyInstance,
  libraryId: string,
  title: string,
  createdAt?: string
): string {
  const id = crypto.randomUUID();
  if (createdAt) {
    getDb(app)
      .prepare(
        'INSERT INTO books (id, library_id, title, format, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, libraryId, title, 'epub', `/books/${id}.epub`, createdAt);
  } else {
    getDb(app)
      .prepare('INSERT INTO books (id, library_id, title, format, file_path) VALUES (?, ?, ?, ?, ?)')
      .run(id, libraryId, title, 'epub', `/books/${id}.epub`);
  }
  return id;
}

function grant(app: FastifyInstance, userId: string, libraryId: string): void {
  getDb(app)
    .prepare('INSERT INTO user_libraries (user_id, library_id) VALUES (?, ?)')
    .run(userId, libraryId);
}

// ---- User-facing library routes ----

describe('User-facing library routes', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userCookie: string;
  let userId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await build({ db: ':memory:', logger: false });

    const users = new UserRepository(getDb(app));
    await users.create({ email: 'admin@example.com', password: 'adminpass', is_admin: true });
    const user = await users.create({ email: 'user@example.com', password: 'userpass' });
    userId = user.id;

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@example.com', password: 'adminpass' },
    });
    adminCookie = adminLogin.headers['set-cookie'] as string;

    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@example.com', password: 'userpass' },
    });
    userCookie = userLogin.headers['set-cookie'] as string;
  });

  afterEach(async () => {
    await app.close();
  });

  test('GET /api/libraries requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/libraries' });
    expect(res.statusCode).toBe(401);
  });

  test('admin sees all libraries', async () => {
    insertLibrary(app, 'Library A');
    insertLibrary(app, 'Library B');

    const res = await app.inject({
      method: 'GET',
      url: '/api/libraries',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(2);
    expect(body.total).toBe(2);
  });

  test('user sees only libraries they have access to', async () => {
    const libA = insertLibrary(app, 'Accessible');
    insertLibrary(app, 'Private');

    getDb(app)
      .prepare('INSERT INTO user_libraries (user_id, library_id) VALUES (?, ?)')
      .run(userId, libA);

    const res = await app.inject({
      method: 'GET',
      url: '/api/libraries',
      headers: { cookie: userCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(libA);
  });

  test('user with no grants sees empty list', async () => {
    insertLibrary(app, 'Private Library');

    const res = await app.inject({
      method: 'GET',
      url: '/api/libraries',
      headers: { cookie: userCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  // ---- List metadata: book_count / user_count / last_import_at (story C.2) ----

  test('an empty library reports 0 books, 0 readers and a null last import', async () => {
    insertLibrary(app, 'Barren');

    const res = await app.inject({
      method: 'GET',
      url: '/api/libraries',
      headers: { cookie: adminCookie },
    });

    const [lib] = res.json().data;
    expect(lib.book_count).toBe(0);
    expect(lib.user_count).toBe(0);
    expect(lib.last_import_at).toBeNull();
  });

  // The regression the correlated-subquery form exists to prevent: a naive
  // LEFT JOIN books + LEFT JOIN user_libraries under one GROUP BY multiplies the
  // rows, so 2 books × 2 grants reports 4 and 4 instead of 2 and 2.
  test('book_count and user_count do not inflate each other', async () => {
    const libId = insertLibrary(app, 'Crossed');
    insertBook(app, libId, 'Book One');
    insertBook(app, libId, 'Book Two');

    const users = new UserRepository(getDb(app));
    const second = await users.create({ email: 'second@example.com', password: 'secondpass' });
    grant(app, userId, libId);
    grant(app, second.id, libId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/libraries',
      headers: { cookie: adminCookie },
    });

    const [lib] = res.json().data;
    expect(lib.book_count).toBe(2);
    expect(lib.user_count).toBe(2);
  });

  test('last_import_at is the newest books.created_at, not the first inserted', async () => {
    const libId = insertLibrary(app, 'Dated');
    insertBook(app, libId, 'Oldest', '2026-04-19 11:02:33');
    insertBook(app, libId, 'Newest', '2026-08-01 09:00:00');
    insertBook(app, libId, 'Middle', '2026-06-15 12:00:00');

    const res = await app.inject({
      method: 'GET',
      url: '/api/libraries',
      headers: { cookie: adminCookie },
    });

    expect(res.json().data[0].last_import_at).toBe('2026-08-01 09:00:00');
  });

  // listForUser is a different SQL statement from listAll, so the non-admin path
  // has to be asserted separately or half the query goes uncovered.
  //
  // 2 books x 2 grants, NOT 1 and 1: listForUser already INNER JOINs user_libraries,
  // so it is the statement most likely to regress into a row-multiplying join — and
  // a 1x1 fixture cannot tell 1 from 1*1. These are the numbers that go red.
  test('a non-admin sees the same three fields, uninflated, on a granted library', async () => {
    const libId = insertLibrary(app, 'Granted');
    insertBook(app, libId, 'First Book', '2026-07-04 08:30:00');
    insertBook(app, libId, 'Second Book', '2026-07-02 08:30:00');

    const users = new UserRepository(getDb(app));
    const second = await users.create({ email: 'granted-too@example.com', password: 'secondpass' });
    grant(app, userId, libId);
    grant(app, second.id, libId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/libraries',
      headers: { cookie: userCookie },
    });

    const [lib] = res.json().data;
    expect(lib.book_count).toBe(2);
    expect(lib.user_count).toBe(2);
    expect(lib.last_import_at).toBe('2026-07-04 08:30:00');
  });

  // findById returns the same Library type but must NOT grow the list-only fields —
  // that is why they are declared optional on the shared interface.
  test('GET /api/libraries/:id does not grow the list-only metadata fields', async () => {
    const libId = insertLibrary(app, 'Single');
    insertBook(app, libId, 'A Book');
    grant(app, userId, libId);

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libId}`,
      headers: { cookie: userCookie },
    });

    const { library } = res.json();
    expect(library.id).toBe(libId);
    expect(library).not.toHaveProperty('book_count');
    expect(library).not.toHaveProperty('user_count');
    expect(library).not.toHaveProperty('last_import_at');
  });

  test('GET /api/libraries/:id returns library for user with access', async () => {
    const libId = insertLibrary(app, 'My Library');
    getDb(app)
      .prepare('INSERT INTO user_libraries (user_id, library_id) VALUES (?, ?)')
      .run(userId, libId);

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libId}`,
      headers: { cookie: userCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().library.id).toBe(libId);
  });

  test('GET /api/libraries/:id returns 403 for user without access', async () => {
    const libId = insertLibrary(app, 'Off-limits');

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libId}`,
      headers: { cookie: userCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  test('GET /api/libraries/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/libraries/does-not-exist',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(404);
  });

  test('admin can access any library by id without explicit grant', async () => {
    const libId = insertLibrary(app, 'Admin Only');

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
  });
});

// ---- Admin library CRUD ----

describe('Admin library CRUD', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userCookie: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await build({ db: ':memory:', logger: false });

    const users = new UserRepository(getDb(app));
    await users.create({ email: 'admin@example.com', password: 'adminpass', is_admin: true });
    await users.create({ email: 'user@example.com', password: 'userpass' });

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@example.com', password: 'adminpass' },
    });
    adminCookie = adminLogin.headers['set-cookie'] as string;

    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@example.com', password: 'userpass' },
    });
    userCookie = userLogin.headers['set-cookie'] as string;
  });

  afterEach(async () => {
    await app.close();
  });

  test('non-admin gets 403 on admin library routes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/libraries',
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  test('unauthenticated request returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/libraries' });
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/admin/libraries returns all libraries with user_count', async () => {
    insertLibrary(app, 'Lib A');
    insertLibrary(app, 'Lib B');

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/libraries',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const { libraries } = res.json();
    expect(libraries.length).toBe(2);
    expect(libraries[0]).toHaveProperty('user_count', 0);
  });

  test('POST /api/admin/libraries creates library and calls mkdir', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/libraries',
      headers: { cookie: adminCookie },
      payload: { name: 'Science Fiction', description: 'Sci-fi books' },
    });

    expect(res.statusCode).toBe(201);
    const { library } = res.json();
    expect(library.name).toBe('Science Fiction');
    expect(library.description).toBe('Sci-fi books');
    expect(library.id).toBeTruthy();
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
      expect.stringContaining(library.id),
      { recursive: true }
    );
  });

  test('POST /api/admin/libraries works without description', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/libraries',
      headers: { cookie: adminCookie },
      payload: { name: 'Minimal Library' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().library.description).toBeNull();
  });

  test('POST /api/admin/libraries rejects missing name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/libraries',
      headers: { cookie: adminCookie },
      payload: { description: 'No name provided' },
    });
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/admin/libraries/:id returns single library', async () => {
    const libId = insertLibrary(app, 'Specific');

    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().library.id).toBe(libId);
  });

  test('GET /api/admin/libraries/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/libraries/nonexistent',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  test('PATCH /api/admin/libraries/:id updates name and description', async () => {
    const libId = insertLibrary(app, 'Old Name', 'Old desc');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/libraries/${libId}`,
      headers: { cookie: adminCookie },
      payload: { name: 'New Name', description: 'New desc' },
    });

    expect(res.statusCode).toBe(200);
    const { library } = res.json();
    expect(library.name).toBe('New Name');
    expect(library.description).toBe('New desc');
  });

  test('PATCH updates only name - description is preserved', async () => {
    const libId = insertLibrary(app, 'Old Name', 'Keep this');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/libraries/${libId}`,
      headers: { cookie: adminCookie },
      payload: { name: 'New Name' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().library.description).toBe('Keep this');
  });

  test('PATCH returns 404 for unknown library', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/libraries/nonexistent',
      headers: { cookie: adminCookie },
      payload: { name: 'Whatever' },
    });
    expect(res.statusCode).toBe(404);
  });

  test('DELETE /api/admin/libraries/:id removes library and calls rm', async () => {
    const libId = insertLibrary(app, 'To Delete');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(204);
    expect(vi.mocked(rm)).toHaveBeenCalledWith(
      expect.stringContaining(libId),
      { recursive: true, force: true }
    );

    // Confirm removed from list
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/admin/libraries',
      headers: { cookie: adminCookie },
    });
    expect(listRes.json().libraries.length).toBe(0);
  });

  test('DELETE returns 404 for unknown library', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/libraries/nonexistent',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  test('DELETE cascades to user_libraries - user_count drops to 0', async () => {
    const libId = insertLibrary(app, 'Cascade Test');
    const users = new UserRepository(getDb(app));
    const user = await users.create({ email: 'temp@example.com', password: 'temppass' });
    getDb(app)
      .prepare('INSERT INTO user_libraries (user_id, library_id) VALUES (?, ?)')
      .run(user.id, libId);

    await app.inject({
      method: 'DELETE',
      url: `/api/admin/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });

    // Library gone - FK cascade cleaned user_libraries
    const row = getDb(app)
      .prepare('SELECT COUNT(*) as count FROM user_libraries WHERE library_id = ?')
      .get(libId) as { count: number };
    expect(row.count).toBe(0);
  });
});

// ---- Admin library ACL (users per library) ----

describe('Admin library ACL', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userId: string;
  let libId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await build({ db: ':memory:', logger: false });

    const users = new UserRepository(getDb(app));
    await users.create({ email: 'admin@example.com', password: 'adminpass', is_admin: true });
    const user = await users.create({ email: 'user@example.com', password: 'userpass' });
    userId = user.id;

    libId = insertLibrary(app, 'Test Library');

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@example.com', password: 'adminpass' },
    });
    adminCookie = loginRes.headers['set-cookie'] as string;
  });

  afterEach(async () => {
    await app.close();
  });

  test('GET /api/admin/libraries/:id/users returns empty list initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/libraries/${libId}/users`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().users).toEqual([]);
  });

  test('user_count is 0 before any grants', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/libraries',
      headers: { cookie: adminCookie },
    });
    expect(res.json().libraries[0].user_count).toBe(0);
  });

  test('user_count increments after grant', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${userId}/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/libraries',
      headers: { cookie: adminCookie },
    });
    expect(res.json().libraries[0].user_count).toBe(1);
  });

  test('GET /api/admin/libraries/:id/users lists users after grant', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${userId}/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/libraries/${libId}/users`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const { users } = res.json();
    expect(users.length).toBe(1);
    expect(users[0].email).toBe('user@example.com');
  });

  test('user_count decrements and users list empties after revoke', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${userId}/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });
    await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${userId}/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });

    const usersRes = await app.inject({
      method: 'GET',
      url: `/api/admin/libraries/${libId}/users`,
      headers: { cookie: adminCookie },
    });
    expect(usersRes.json().users).toEqual([]);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/admin/libraries',
      headers: { cookie: adminCookie },
    });
    expect(listRes.json().libraries[0].user_count).toBe(0);
  });

  test('GET /api/admin/libraries/:id/users returns 404 for unknown library', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/libraries/nonexistent/users',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  test('granting duplicate access is idempotent', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${userId}/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${userId}/libraries/${libId}`,
      headers: { cookie: adminCookie },
    });

    // INSERT OR IGNORE means second grant should still succeed
    expect(res.statusCode).toBe(204);

    const usersRes = await app.inject({
      method: 'GET',
      url: `/api/admin/libraries/${libId}/users`,
      headers: { cookie: adminCookie },
    });
    expect(usersRes.json().users.length).toBe(1);
  });
});
