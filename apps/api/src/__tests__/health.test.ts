import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { build } from '../app.js';

describe('Health endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Fresh in-memory DB each run
    app = await build({ db: ':memory:', logger: false });
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
    });

    expect(res.statusCode).toBe(404);
  });

  test('POST /api/auth/login returns 501', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'password' },
    });

    expect(res.statusCode).toBe(501);
  });
});
