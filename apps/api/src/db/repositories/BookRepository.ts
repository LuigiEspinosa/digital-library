import { nanoid } from "nanoid";
import type { Db } from "../connection.js";
import type { Book, BookFormat } from "@digital-library/shared";

interface DbBook {
  id: String;
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
  created_at: string;
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
    created_at: row.created_at,
  };
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
}

export class BookRepository {
  constructor(private db: Db) { }

  findById(id: string): Book | null {
    const row = this.db
      .prepare('SELECT * FROM books WHERE id = ?')
      .get(id) as DbBook | undefined;
    return row ? toBook(row) : null;
  }

  findBySha256(sha256: string): Book | null {
    const row = this.db
      .prepare('SELECT * FROM books WHERE sha256 = ?')
      .get(sha256) as DbBook | undefined;
    return row ? toBook(row) : null;
  }

  findByLibrary(
    libraryId: string,
    opts: { limit: number; offset: number }
  ): { books: Book[]; total: number } {
    const { count } = this.db
      .prepare('SELECT COUNT(*) as count FROM books WHERE library_id = ?')
      .get(libraryId) as { count: number };

    const rows = this.db
      .prepare(
        'SELECT * FROM books WHERE library_id = ? ORDER BY title ASC LIMIT ? OFFSET ?'
      )
      .all(libraryId, opts.limit, opts.offset) as DbBook[];

    return { books: rows.map(toBook), total: count };
  }

  findAll(
    allowedLibraryIds: string[],
    opts: { limit: number; offset: number }
  ): { books: Book[]; total: number } {
    if (allowedLibraryIds.length === 0) return { books: [], total: 0 };

    const placeholders = allowedLibraryIds.map(() => '?').join(', ');

    const { count } = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM books WHERE library_id IN (${placeholders})`
      )
      .get(...allowedLibraryIds) as { count: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM books WHERE library_id IN (${placeholders}) ORDER BY title ASC LIMIT ? OFFSET ?`
      )
      .all(...allowedLibraryIds, opts.limit, opts.offset) as DbBook[];

    return { books: rows.map(toBook), total: count };
  }

  create(input: CreateBookInput): Book {
    const id = nanoid();
    this.db
      .prepare(
        `INSERT INTO books (
          id, library_id, title, author, format, file_path, cover_path,
          description, series, series_idx, tags, isbn, published_at,
          page_count, file_size, sha256
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        input.sha256
      );

    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM books WHERE id = ?').run(id);
  }
}
