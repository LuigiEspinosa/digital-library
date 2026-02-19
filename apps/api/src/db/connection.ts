import Database from 'better-sqlite3';
import path from 'node:path';

export function createDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? path.resolve(process.env.DATABASE_PATH ?? '/data/library.db');

  const db = new Database(resolvedPath);

  // Apply pragmas immediately after opening.
  // WAL mode is especially important for the file watcher + API combo:
  // Without it, write transactions block all reads during bulk imports.
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -32000'); // 32 MB page cache

  return db;
}

export type Db = ReturnType<typeof createDb>;
