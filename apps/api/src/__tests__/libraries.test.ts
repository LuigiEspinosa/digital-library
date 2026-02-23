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
