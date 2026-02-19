import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { build } from '../app.js';

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Fresh in-memory DB each run
    app = await build({ db: ':memory:', logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  // ---- Login ----

  test('login with valid credentials returns 200 and sets cookie', async () => {
    // Create a user first via admin route
    await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      payload: { email: 'cuatro@example.com', password: 'password123' },
      // Bypass admin check by injecting as admin — we'll test ACL separately
    });

    // We need an admin session to call the admin route, so seed directly
    // by using the first-admin path: restart with env vars set
    const seedApp = await build({
      db: ':memory:',
      logger: false,
    });
    // Manually seed a user through the repository
    const { UserRepository } = await import('../db/repositories/UserRepository.js');
    const users = new UserRepository((seedApp as any).db);
    await users.create({ email: 'cuatro@example.com', password: 'password123' });

    const res = await seedApp.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'cuatro@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe('cuatro@example.com');
    expect(res.headers['set-cookie']).toBeTruthy();

    await seedApp.close();
  });

  test('login with wrong password returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'wrongpass' },
    });
    expect(res.statusCode).toBe(401);
  });

  test('login with missing fields returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com' }, // missing password
    });
    expect(res.statusCode).toBe(400);
  });

  // ---- /me ----

  test('GET /me without cookie returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });

  test('GET /me with valid session returns user', async () => {
    const { UserRepository } = await import('../db/repositories/UserRepository.js');
    const users = new UserRepository((app as any).db);
    await users.create({ email: 'bob@example.com', password: 'password123' });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'bob@example.com', password: 'password123' },
    });
    const cookie = loginRes.headers['set-cookie'] as string;

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().user.email).toBe('bob@example.com');
  });

  // ---- Logout ----

  test('logout invalidates session — subsequent /me returns 401', async () => {
    const { UserRepository } = await import('../db/repositories/UserRepository.js');
    const users = new UserRepository((app as any).db);
    await users.create({ email: 'celeste@example.com', password: 'password123' });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'celeste@example.com', password: 'password123' },
    });
    const cookie = loginRes.headers['set-cookie'] as string;

    await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    expect(meRes.statusCode).toBe(401);
  });
});

describe('Admin user routes', () => {
  let app: FastifyInstance;
  let adminCookie: string;

  beforeEach(async () => {
    app = await build({ db: ':memory:', logger: false });

    // Seed an admin user directly via repository
    const { UserRepository } = await import('../db/repositories/UserRepository.js');
    const users = new UserRepository((app as any).db);
    await users.create({ email: 'admin@example.com', password: 'adminpass', is_admin: true });
    await users.create({ email: 'regular@example.com', password: 'userpass', is_admin: false });

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

  test('GET /admin/users returns user list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().users.length).toBe(2);
  });

  test('POST /admin/users creates a new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCookie },
      payload: { email: 'new@example.com', password: 'newpassword' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.email).toBe('new@example.com');
  });

  test('POST /admin/users with duplicate email returns 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCookie },
      payload: { email: 'regular@example.com', password: 'whatever' },
    });
    expect(res.statusCode).toBe(409);
  });

  test('DELETE /admin/users/:id deletes user', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { cookie: adminCookie },
    });
    const regularUser = listRes.json().users.find((u: any) => !u.is_admin);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${regularUser.id}`,
      headers: { cookie: adminCookie },
    });
    expect(deleteRes.statusCode).toBe(204);
  });

  test('DELETE /admin/users/:id cannot delete own account', async () => {
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: adminCookie },
    });
    const adminId = meRes.json().user.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${adminId}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  test('non-admin cannot access admin routes', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'regular@example.com', password: 'userpass' },
    });
    const userCookie = loginRes.headers['set-cookie'] as string;

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  test('unauthenticated request to admin route returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('ACL routes', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let regularUserId: string;
  let libraryId: string;

  beforeEach(async () => {
    app = await build({ db: ':memory:', logger: false });

    const { UserRepository } = await import('../db/repositories/UserRepository.js');
    const users = new UserRepository((app as any).db);
    await users.create({ email: 'admin@example.com', password: 'adminpass', is_admin: true });
    const regularUser = await users.create({ email: 'regular@example.com', password: 'userpass' });
    regularUserId = regularUser.id;

    // Create a library directly in DB
    const { nanoid } = await import('nanoid');
    libraryId = nanoid();
    (app as any).db.prepare(
      'INSERT INTO libraries (id, name) VALUES (?, ?)'
    ).run(libraryId, 'Test Library');

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

  test('admin can grant library access to user', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${regularUserId}/libraries/${libraryId}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(204);
  });

  test('admin can revoke library access from user', async () => {
    // Grant first
    await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${regularUserId}/libraries/${libraryId}`,
      headers: { cookie: adminCookie },
    });

    // Then revoke
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${regularUserId}/libraries/${libraryId}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(204);
  });

  test('granting access to non-existent library returns 404', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${regularUserId}/libraries/nonexistent`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
