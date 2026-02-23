import type { Db } from './connection.js';

export function runMigrations(db: Db): void {
  db.exec(`
    -- ── Users ────────────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS users (
      id                  TEXT PRIMARY KEY,
      email               TEXT NOT NULL UNIQUE,
      hashed_password     TEXT NOT NULL,
      is_admin            INTEGER NOT NULL DEFAULT 0,
      kindle_email        TEXT,
      created_at          TEXT DEFAULT (datetime('now'))
    );

    -- ── Sessions (lucia-auth v3 compatible) ──────────────────────────────

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at    INTEGER NOT NULL
    );

    -- ── Libraries ─────────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS libraries (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      description     TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- ── Per-library ACL ───────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS user_libraries (
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      library_id    TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, library_id)
    );

    -- ── Books ─────────────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS books (
      id              TEXT PRIMARY KEY,
      library_id      TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      author          TEXT,
      format          TEXT NOT NULL,
      file_path       TEXT NOT NULL UNIQUE,
      cover_path      TEXT,
      description     TEXT,
      series          TEXT,
      series_idx      REAL,
      tags            TEXT,
      isbn            TEXT,
      published_at    TEXT,
      page_count      INTEGER,
      file_size       INTEGER,
      sha256          TEXT UNIQUE,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- ── FTS5 virtual table ────────────────────────────────────────────────
    -- content= makes it a content table (reads from books);
    -- the trigger below keeps it in sync.

    CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
      title, author, description, tags, series,
      content='books',
      content_rowid='rowid',
      tokenize='porter ascii'
    );

    -- ── FTS5 sync triggers ────────────────────────────────────────────────

    CREATE TRIGGER IF NOT EXISTS books_ai AFTER INSERT ON books BEGIN
      INSERT INTO books_fts(rowid, title, author, description, tags, series)
      VALUES (new.rowid, new.title, new.author, new.description, new.tags, new.series);
    END;

    CREATE TRIGGER IF NOT EXISTS books_au AFTER UPDATE ON books BEGIN
      INSERT INTO books_fts(books_fts, rowid, title, author, description, tags, series)
      VALUES ('delete', old.rowid, old.title, old.author, old.description, old.tags, old.series);
      INSERT INTO books_fts(rowid, title, author, description, tags, series)
      VALUES (new.rowid, new.title, new.author, new.description, new.tags, new.series);
    END;

    CREATE TRIGGER IF NOT EXISTS books_ad AFTER DELETE ON books BEGIN
      INSERT INTO books_fts(books_fts, rowid, title, author, description, tags, series)
      VALUES ('delete', old.rowid, old.title, old.author, old.description, old.tags, old.series);
    END;

    -- ── Reading Progress ──────────────────────────────────────────────────
    -- position stores CFI string for EPUB, page number string for PDF/comics.
    -- Never store epub.js page numbers - always use CFI.

    CREATE TABLE IF NOT EXISTS reading_progress (
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      position      TEXT NOT NULL,
      updated_at    TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, book_id)
    );
  `);
}
