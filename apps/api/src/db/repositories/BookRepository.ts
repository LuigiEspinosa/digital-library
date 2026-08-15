import { nanoid } from 'nanoid';
import type { Db } from '../connection.js';
import type {
  Book,
  BookFormat,
  BookWithProgress,
  LibraryFilters,
} from '@digital-library/shared';
import { sanitizeFtsQuery } from '../ftsSanitizer.js';

interface DbBook {
  id: string;
  library_id: string;
  title: string;
  author: string | null;
  format: string;
  file_path: string;
  cover_path: string | null;
  description: string | null;
  series: string | null;
  series_idx: number | null;
  tags: string | null;
  isbn: string | null;
  published_at: string | null;
  page_count: number | null;
  file_size: number | null;
  sha256: string | null;
  language: string | null;
  created_at: string;
  // Only selected by findByLibrary's two row queries; absent on every other read.
  progress_position?: string | null;
}

function toBook(row: DbBook): Book {
  return {
    id: row.id,
    library_id: row.library_id,
    title: row.title,
    author: row.author ?? undefined,
    format: row.format as BookFormat,
    file_path: row.file_path,
    cover_path: row.cover_path ?? undefined,
    description: row.description ?? undefined,
    series: row.series ?? undefined,
    series_idx: row.series_idx ?? undefined,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : undefined,
    isbn: row.isbn ?? undefined,
    published_at: row.published_at ?? undefined,
    page_count: row.page_count ?? undefined,
    file_size: row.file_size ?? undefined,
    language: row.language ?? undefined,
    created_at: row.created_at,
  };
}

function toBookWithProgress(row: DbBook): BookWithProgress {
  return { ...toBook(row), progress_position: row.progress_position ?? null };
}

export interface CreateBookInput {
  library_id: string;
  title: string;
  author?: string;
  format: BookFormat;
  file_path: string;
  cover_path?: string;
  description?: string;
  series?: string;
  series_idx?: number;
  tags?: string[];
  isbn?: string;
  published_at?: string;
  page_count?: number;
  file_size?: number;
  sha256: string;
  language?: string;
}

export interface BookFilters {
  q?: string;
  format?: string;
  author?: string;
  series?: string;
  tags?: string[];
  language?: string;
  sort?: 'title' | 'author' | 'created_at' | 'published_at';
  order?: 'asc' | 'desc';
}

const VALID_SORT = ['title', 'author', 'created_at', 'published_at'] as const;

// Every format a book can actually be stored as. Used only to cap the comma-list
// filter — no list of real formats can be longer than this, so anything past it is
// a hand-crafted URL, not a user.
const VALID_FORMATS = ['epub', 'pdf', 'cbz', 'cbr', 'images'] as const;

export class BookRepository {
  constructor(private db: Db) {}

  findById(id: string): Book | null {
    const row = this.db.prepare('SELECT * FROM books WHERE id = ?').get(id) as
      | DbBook
      | undefined;
    return row ? toBook(row) : null;
  }

  findBySha256(sha256: string): Book | null {
    const row = this.db
      .prepare('SELECT * FROM books WHERE sha256 = ?')
      .get(sha256) as DbBook | undefined;
    return row ? toBook(row) : null;
  }

  /**
   * The requesting user's stored position rides along on every row, so the browse
   * grid can label reading progress without one request per tile.
   *
   * reading_progress's PRIMARY KEY (user_id, book_id) means at most one row per
   * (user, book), so the LEFT JOIN cannot multiply rows.
   */
  findByLibrary(
    libraryId: string,
    opts: { limit: number; offset: number },
    filters: BookFilters = {},
    userId: string,
  ): { books: BookWithProgress[]; total: number } {
    const conditions: string[] = ['b.library_id = ?'];
    const params: (string | number)[] = [libraryId];

    // A comma-separated list so the UI's single COMIC segment can match cbz, cbr
    // and images at once. One value still yields `IN (?)` and behaves exactly as
    // the old `= ?` did, so bookmarked ?format=epub URLs are unaffected.
    if (filters.format) {
      // Deduped and capped: each distinct comma count is a distinct statement for
      // better-sqlite3 to prepare, and a long enough hand-crafted list would pass
      // SQLITE_MAX_VARIABLE_NUMBER and throw out of prepare() as an opaque 500.
      const formats = [
        ...new Set(
          filters.format
            .split(',')
            .map((f) => f.trim().toLowerCase())
            .filter(Boolean),
        ),
      ].slice(0, VALID_FORMATS.length);

      // A caller that asked to filter and named nothing usable (`?format=,`) gets
      // zero rows, never the whole library — silently dropping the condition made
      // an unfiltered list look like a filtered one.
      conditions.push(
        formats.length ? `b.format IN (${formats.map(() => '?').join(', ')})` : '0',
      );
      params.push(...formats);
    }
    if (filters.author) {
      conditions.push('b.author = ?');
      params.push(filters.author);
    }
    if (filters.series) {
      conditions.push('b.series = ?');
      params.push(filters.series);
    }
    if (filters.language) {
      conditions.push('b.language = ?');
      params.push(filters.language);
    }
    if (filters.tags && filters.tags.length > 0) {
      const tagClauses = filters.tags
        .map(() => 'EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value = ?)')
        .join(' OR ');
      conditions.push(`(${tagClauses})`);
      params.push(...filters.tags);
    }

    // better-sqlite3 binds `?` by position in the STATEMENT TEXT, and the join's
    // rp.user_id = ? sits ahead of every WHERE placeholder — so userId leads the
    // row queries' parameter lists. The COUNT queries do not carry the join and
    // therefore keep their original text and parameters untouched.
    const progressJoin =
      'LEFT JOIN reading_progress rp ON rp.book_id = b.id AND rp.user_id = ?';

    const rawQ = filters.q?.trim() ?? '';
    if (rawQ.length > 0) {
      const ftsQuery = sanitizeFtsQuery(rawQ);
      if (ftsQuery === null) return { books: [], total: 0 };

      // MATCH must be the first condition so FTS5 can use its index
      const where = ['books_fts MATCH ?', ...conditions].join(' AND ');
      const ftsParams: (string | number)[] = [ftsQuery, ...params];

      const { count } = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM books b JOIN books_fts ON books_fts.rowid = b.rowid WHERE ${where}`,
        )
        .get(...ftsParams) as { count: number };

      const rows = this.db
        .prepare(
          `SELECT b.*, rp.position AS progress_position FROM books b JOIN books_fts ON books_fts.rowid = b.rowid ${progressJoin} WHERE ${where} ORDER BY books_fts.rank LIMIT ? OFFSET ?`,
        )
        .all(userId, ...ftsParams, opts.limit, opts.offset) as DbBook[];

      return { books: rows.map(toBookWithProgress), total: count };
    }

    const where = conditions.join(' AND ');
    const sortCol =
      filters.sort && (VALID_SORT as readonly string[]).includes(filters.sort)
        ? filters.sort
        : 'title';
    const orderDir = filters.order === 'desc' ? 'DESC' : 'ASC';

    const { count } = this.db
      .prepare(`SELECT COUNT(*) as count FROM books b WHERE ${where}`)
      .get(...params) as { count: number };

    const rows = this.db
      .prepare(
        `SELECT b.*, rp.position AS progress_position FROM books b ${progressJoin} WHERE ${where} ORDER BY b.${sortCol} ${orderDir} LIMIT ? OFFSET ?`,
      )
      .all(userId, ...params, opts.limit, opts.offset) as DbBook[];

    return { books: rows.map(toBookWithProgress), total: count };
  }

  findAll(
    allowedLibraryIds: string[],
    opts: { limit: number; offset: number },
  ): { books: Book[]; total: number } {
    if (allowedLibraryIds.length === 0) return { books: [], total: 0 };

    const placeholders = allowedLibraryIds.map(() => '?').join(', ');

    const { count } = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM books WHERE library_id IN (${placeholders})`,
      )
      .get(...allowedLibraryIds) as { count: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM books WHERE library_id IN (${placeholders}) ORDER BY title ASC LIMIT ? OFFSET ?`,
      )
      .all(...allowedLibraryIds, opts.limit, opts.offset) as DbBook[];

    return { books: rows.map(toBook), total: count };
  }

  getFilters(libraryId: string): LibraryFilters {
    const formats = (
      this.db
        .prepare(
          'SELECT DISTINCT format FROM books WHERE library_id = ? ORDER by format',
        )
        .all(libraryId) as { format: string }[]
    ).map((r) => r.format);

    const authors = (
      this.db
        .prepare(
          'SELECT DISTINCT author FROM books WHERE library_id = ? AND author is NOT NULL ORDER by author',
        )
        .all(libraryId) as { author: string }[]
    ).map((r) => r.author);

    const series = (
      this.db
        .prepare(
          'SELECT DISTINCT series FROM books WHERE library_id = ? AND series is NOT NULL ORDER by series',
        )
        .all(libraryId) as { series: string }[]
    ).map((r) => r.series);

    const languages = (
      this.db
        .prepare(
          'SELECT DISTINCT language FROM books WHERE library_id = ? AND language is NOT NULL ORDER by language',
        )
        .all(libraryId) as { language: string }[]
    ).map((r) => r.language);

    const tags = (
      this.db
        .prepare(
          `
        SELECT DISTINCT value as tag
        FROM books, json_each(books.tags)
        WHERE library_id = ? AND tags IS NOT NULL
        ORDER BY value
      `,
        )
        .all(libraryId) as { tag: string }[]
    ).map((r) => r.tag);

    return { formats, authors, series, languages, tags };
  }

  getProgress(userId: string, bookId: string): string | null {
    const row = this.db
      .prepare(
        'SELECT position FROM reading_progress WHERE user_id =? AND book_id = ?',
      )
      .get(userId, bookId) as { position: string } | undefined;
    return row?.position ?? null;
  }

  setProgress(userId: string, bookId: string, position: string): void {
    this.db
      .prepare(
        `
        INSERT INTO reading_progress (user_id, book_id, position, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT (user_id, book_id) DO UPDATE SET
          position = excluded.position,
          updated_at = excluded.updated_at
      `,
      )
      .run(userId, bookId, position);
  }

  create(input: CreateBookInput): Book {
    const id = nanoid();
    this.db
      .prepare(
        `INSERT INTO books (
          id, library_id, title, author, format, file_path, cover_path,
          description, series, series_idx, tags, isbn, published_at,
          page_count, file_size, sha256, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.library_id,
        input.title,
        input.author ?? null,
        input.format,
        input.file_path,
        input.cover_path ?? null,
        input.description ?? null,
        input.series ?? null,
        input.series_idx ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        input.isbn ?? null,
        input.published_at ?? null,
        input.page_count ?? null,
        input.file_size ?? null,
        input.sha256,
        input.language ?? null,
      );

    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM books WHERE id = ?').run(id);
  }
}
