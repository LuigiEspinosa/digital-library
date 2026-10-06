import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEMO_PRINCIPAL } from './acl.js';
import { createDb, type Db } from './db/connection.js';
import { DEMO_BOOKS, DEMO_LIBRARY, demoPdf } from './demo-fixture.js';
import { booksRoot, coversRoot } from './services/importBook.js';

/**
 * `demo:reset` in digital-library (cuatro-portfolio Story 5.9, AD-13), to the one
 * definition in that repository's `ops/demo-principal.md` § The reset.
 *
 * The demo scope is the libraries the demo principal holds. The reset creates
 * that scope's one library itself, `DEMO_LIBRARY`, so the scope is expected to
 * hold that library alone: a library an administrator granted the demo principal
 * may hold the Operator's books, so the reset refuses rather than delete it. It
 * deletes the fixture library with its books, reading progress, uploaded files
 * and covers, and reseeds the fixture, in one transaction for the rows. It keeps
 * the demo principal's account and sessions, and never writes `users`. It never
 * migrates.
 *
 * From the host, a one-shot container from the serving image:
 *
 *   docker compose run --rm --no-deps api node apps/api/dist/demo-reset.js
 */

export const APP_ID = 'digital-library';

export interface Roots {
  books: string;
  covers: string;
}

export type ResetOutcome = { status: 'reset'; rows: number } | { status: 'skipped'; reason: string };

/** Thrown when the reset would have to delete something it did not create. */
export class ResetRefused extends Error {}

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

/** True when `file` lies inside `dir`: the reset removes no file outside its scope's directories. */
const inside = (dir: string, file: string) => {
  const rel = path.relative(path.resolve(dir), path.resolve(file));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

export async function resetDemoScope(db: Db, roots: Roots = { books: booksRoot(), covers: coversRoot() }): Promise<ResetOutcome> {
  const demo = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_PRINCIPAL) as { id: string } | undefined;
  if (!demo) return { status: 'skipped', reason: 'the demo principal is absent' };

  const held = (db.prepare('SELECT library_id FROM user_libraries WHERE user_id = ?').all(demo.id) as { library_id: string }[])
    .map((r) => r.library_id);
  if (held.some((id) => id !== DEMO_LIBRARY.id)) {
    throw new ResetRefused('the demo scope holds a library the reset did not create');
  }
  const exists = db.prepare('SELECT 1 FROM libraries WHERE id = ?').get(DEMO_LIBRARY.id) !== undefined;
  const others = db.prepare('SELECT 1 FROM user_libraries WHERE library_id = ? AND user_id <> ?').get(DEMO_LIBRARY.id, demo.id);
  if ((exists && !held.includes(DEMO_LIBRARY.id)) || others) {
    throw new ResetRefused('the fixture library is outside the demo scope');
  }

  const libraryDir = path.join(roots.books, DEMO_LIBRARY.id);
  const covers = (db.prepare('SELECT cover_path FROM books WHERE library_id = ? AND cover_path IS NOT NULL').all(DEMO_LIBRARY.id) as {
    cover_path: string;
  }[]).map((r) => r.cover_path);
  const files = DEMO_BOOKS.map((b) => ({ book: b, data: demoPdf(b.title, b.text), file: path.join(libraryDir, `${b.id}.pdf`) }));

  db.transaction(() => {
    // The foreign keys cascade to the library's books, grants and reading progress.
    db.prepare('DELETE FROM libraries WHERE id = ?').run(DEMO_LIBRARY.id);
    db.prepare('INSERT INTO libraries (id, name, description, created_at) VALUES (?, ?, ?, ?)').run(
      DEMO_LIBRARY.id,
      DEMO_LIBRARY.name,
      DEMO_LIBRARY.description,
      DEMO_LIBRARY.created_at,
    );
    db.prepare('INSERT INTO user_libraries (user_id, library_id) VALUES (?, ?)').run(demo.id, DEMO_LIBRARY.id);
    const insert = db.prepare(`
      INSERT INTO books (id, library_id, title, author, format, file_path, published_at, page_count, file_size, sha256, language, created_at)
      VALUES (?, ?, ?, ?, 'pdf', ?, ?, 1, ?, ?, ?, ?)
    `);
    for (const { book, data, file } of files) {
      insert.run(book.id, DEMO_LIBRARY.id, book.title, book.author, file, book.published_at, data.length, sha256(data), book.language, book.created_at);
    }
  })();

  // The files after the rows: what Visitors uploaded and its covers go, the fixture's are written afresh.
  await rm(libraryDir, { recursive: true, force: true });
  for (const cover of covers) if (inside(roots.covers, cover)) await unlink(cover).catch(() => {});
  await mkdir(libraryDir, { recursive: true });
  for (const { data, file } of files) await writeFile(file, data);

  return { status: 'reset', rows: 2 + files.length };
}

/** The command: one line out, exit 0 for reset or skipped, one line on stderr and exit 1 for a fault. */
export async function main(out: { write(s: string): unknown } = process.stdout, err: { write(s: string): unknown } = process.stderr): Promise<number> {
  let db: Db | undefined;
  try {
    // createDb's own default. Opening a missing file would create an empty one, so a reset never does.
    const file = path.resolve(process.env.DATABASE_PATH ?? '/data/library.db');
    if (!existsSync(file)) throw new ResetRefused('no database at DATABASE_PATH');
    db = createDb(file);
    const outcome = await resetDemoScope(db);
    out.write(
      outcome.status === 'reset'
        ? `demo:reset ${APP_ID} reset rows=${outcome.rows}\n`
        : `demo:reset ${APP_ID} skipped: ${outcome.reason}\n`,
    );
    return 0;
  } catch (e) {
    // A refusal's own words, else the error's class and code: a driver message can quote a row.
    const reason = e instanceof ResetRefused ? e.message : `${(e as Error)?.name ?? 'Error'}${(e as { code?: string })?.code ? ` ${(e as { code: string }).code}` : ''}`;
    err.write(`demo:reset ${APP_ID} failed: ${reason}\n`);
    return 1;
  } finally {
    db?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
