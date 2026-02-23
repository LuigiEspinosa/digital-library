import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { build } from '../app.js';

describe('Health endpoint', () => {
  let app: FastifyInstance;
  let adminCookie: string;

  beforeEach(async () => {
    // Fresh in-memory DB each run
    app = await build({ db: ':memory:', logger: false });

    const { UserRepository } = await import('../db/repositories/UserRepository.js');
    const users = new UserRepository((app as any).db);
    await users.create({ email: 'admin@test.com', password: 'pass', is_admin: true });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'pass' },
    });
    adminCookie = login.headers['set-cookie'] as string;
  });

  afterEach(async () => {
    await app.close();
  });

  test('GET /api/health returns 200 with expected shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.book_count).toBe('number');
  });

  test('GET /api/books returns empty paginated list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/books',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('GET /api/books/:id returns 404 for unknown book', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/books/nonexistent',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(404);
  });
});
