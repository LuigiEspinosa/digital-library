import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { build } from '../app.js';
import { UserRepository } from '../db/repositories/UserRepository.js';
import { BookRepository, type CreateBookInput } from '../db/repositories/BookRepository.js';

function getDb(app: FastifyInstance): any {
  return (app as unknown as { db: ReturnType<typeof getDb> }).db;
}

describe('Book filter & browse', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let libraryId: string;
  let repo: BookRepository;
  let sha256Seq = 0;

  function book(overrides: Partial<CreateBookInput> = {}): ReturnType<BookRepository['create']> {
    const seq = ++sha256Seq;
    return repo.create({
      library_id: libraryId,
      title: 'Default Title',
      format: 'epub',
      file_path: `/fake/path-${seq}.epub`,
      sha256: `sha-${seq}`,
      ...overrides,
    });
  }

  beforeEach(async () => {
    sha256Seq = 0;
    app = await build({ db: ':memory:', logger: false });

    const users = new UserRepository(getDb(app));
    await users.create({ email: 'admin@test.com', password: 'adminpass', is_admin: true });
    await users.create({ email: 'user@test.com', password: 'userpass' });

    const { nanoid } = await import('nanoid');
    libraryId = nanoid();
    getDb(app).prepare('INSERT INTO libraries (id, name) VALUES (?, ?)').run(libraryId, 'Test Library');

    repo = new BookRepository(getDb(app));

    const login = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'adminpass' },
    });
    adminCookie = login.headers['set-cookie'] as string;
  });

  afterEach(async () => {
    await app.close();
  });

  // ---- GET /libraries/:id/books filters ----

  test('format filter returns only matching books', async () => {
    book({ title: 'EPUB Book', format: 'epub' });
    book({ title: 'PDF Book', format: 'pdf' });
    book({ title: 'CBZ Book', format: 'cbz' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?format=epub`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const { data, total } = res.json();
    expect(total).toBe(1);
    expect(data[0].format).toBe('epub');
  });

  test('author filter returns exact match only', async () => {
    book({ title: 'Alice Book', author: 'Alice' });
    book({ title: 'Bob Book', author: 'Bob' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?author=Alice`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const { data, total } = res.json();
    expect(total).toBe(1);
    expect(data[0].author).toBe('Alice');
  });

  test('series filter returns exact match only', async () => {
    book({ title: 'Vol 1', series: 'My Series', series_idx: 1 });
    book({ title: 'Standalone' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?series=My+Series`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].series).toBe('My Series');
  });

  test('language filter returns matching books', async () => {
    book({ title: 'English', language: 'en' });
    book({ title: 'French', language: 'fr' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?language=en`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].language).toBe('en');
  });

  test('tags filter (single tag) matches books containing that tag', async () => {
    book({ title: 'Tagged', tags: ['fiction', 'adventure'] });
    book({ title: 'Untagged' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?tags=fiction`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].title).toBe('Tagged');
  });

  test('tags filter (multiple tags) uses OR semantics', async () => {
    book({ title: 'Fiction Only', tags: ['fiction'] });
    book({ title: 'Adventure Only', tags: ['adventure'] });
    book({ title: 'Reference', tags: ['reference'] });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?tags=fiction,adventure`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(2);
  });

  test('full-text search filters by title', async () => {
    book({ title: 'Robots and Science' });
    book({ title: 'History of Cooking' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?q=Robots`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].title).toBe('Robots and Science');
  });

  test('full-text search filters by author', async () => {
    book({ title: 'Some Book', author: 'Tolkien' });
    book({ title: 'Another Book', author: 'Hemingway' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?q=Tolkien`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].author).toBe('Tolkien');
  });

  // ---- Sorting ----

  test('defaults to title ascending', async () => {
    book({ title: 'Zebra' });
    book({ title: 'Apple' });
    book({ title: 'Mango' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const titles = res.json().data.map((b: { title: string }) => b.title);
    expect(titles).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  test('sort=title order=desc reverses order', async () => {
    book({ title: 'Zebra' });
    book({ title: 'Apple' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?sort=title&order=desc`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const titles = res.json().data.map((b: { title: string }) => b.title);
    expect(titles[0]).toBe('Zebra');
    expect(titles[titles.length - 1]).toBe('Apple');
  });

  test('invalid sort column defaults to title asc (SQL injection guard)', async () => {
    book({ title: 'B Book' });
    book({ title: 'A Book' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?sort=DROP+TABLE+books`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const titles = res.json().data.map((b: { title: string }) => b.title);
    expect(titles[0]).toBe('A Book');
  });

  // ---- Pagination ----

  test('limit and offset return correct page', async () => {
    for (let i = 1; i <= 5; i++) {
      book({ title: `Book ${String(i).padStart(2, '0')}` });
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?limit=2&offset=2`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const { data, total } = res.json();
    expect(total).toBe(5);       // full count unaffected by pagination
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe('Book 03');
  });

  test('limit is capped at 100', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/libraries/${libraryId}/books?limit=9999`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().limit).toBe(100);
  });

  // ---- GET /libraries/:id/books/filters ----

  describe('GET /libraries/:id/books/filters', () => {
    test('returns empty arrays for an empty library', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/libraries/${libraryId}/books/filters`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        formats: [],
        authors: [],
        series: [],
        languages: [],
        tags: [],
      });
    });

    test('returns sorted distinct values', async () => {
      book({ format: 'epub', author: 'Alice', series: 'S1', language: 'en', tags: ['fiction'] });
      book({ format: 'pdf', author: 'Bob', series: 'S2', language: 'fr', tags: ['adventure', 'fiction'] });
      book({ format: 'epub', author: 'Alice' }); // duplicates

      const res = await app.inject({
        method: 'GET',
        url: `/api/libraries/${libraryId}/books/filters`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.formats).toEqual(['epub', 'pdf']);
      expect(body.authors).toEqual(['Alice', 'Bob']);
      expect(body.series).toEqual(['S1', 'S2']);
      expect(body.languages).toEqual(['en', 'fr']);
      expect(body.tags).toEqual(['adventure', 'fiction']); // deduplicated across books
    });

    test('does not include data from other libraries', async () => {
      const { nanoid } = await import('nanoid');
      const otherId = nanoid();
      getDb(app).prepare('INSERT INTO libraries (id, name) VALUES (?, ?)').run(otherId, 'Other');

      book({ format: 'epub', author: 'Alice' });
      repo.create({
        library_id: otherId,
        title: 'Other Book',
        format: 'pdf',
        author: 'Bob',
        file_path: '/fake/other.pdf',
        sha256: `sha-other-${++sha256Seq}`,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/libraries/${libraryId}/books/filters`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().formats).toEqual(['epub']);
      expect(res.json().authors).toEqual(['Alice']);
    });

    test('returns 403 for user without library access', async () => {
      const userLogin = await app.inject({
        method: 'POST', url: '/api/auth/login',
        payload: { email: 'user@test.com', password: 'userpass' },
      });
      const userCookie = userLogin.headers['set-cookie'] as string;

      const res = await app.inject({
        method: 'GET',
        url: `/api/libraries/${libraryId}/books/filters`,
        headers: { cookie: userCookie },
      });

      expect(res.statusCode).toBe(403);
    });

    test('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/libraries/${libraryId}/books/filters`,
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
