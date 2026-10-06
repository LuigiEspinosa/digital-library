import type { Db } from "./db/connection.js";

/**
 * The demo principal contract (cuatro-portfolio Story 5.8, AD-13, the record
 * `ops/demo-principal.md` in cuatro-portfolio). The address is the contract's,
 * never this application's. Its ownership scope is the set of libraries it
 * holds: a library is in the demo scope while the demo principal holds it, and
 * no one else ever holds it or reads in it. Without a demo principal account,
 * nothing here changes what anyone can reach.
 */
export const DEMO_PRINCIPAL = 'demo@cuatro.dev';

export function isDemoPrincipal(email: unknown): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === DEMO_PRINCIPAL;
}

function demoUserId(db: Db): string | undefined {
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_PRINCIPAL) as
    | { id: string }
    | undefined;
  return row?.id;
}

/** True when the library is in the demo principal's scope. */
export function inDemoScope(db: Db, libraryId: string): boolean {
  const demo = demoUserId(db);
  if (demo === undefined) return false;
  return (
    db
      .prepare('SELECT 1 FROM user_libraries WHERE user_id = ? AND library_id = ?')
      .get(demo, libraryId) !== undefined
  );
}

/**
 * Returns true if the user has access to the library.
 * Admin users bypass all ACL checks, except the scope boundary: no one reaches
 * across it, so the Operator never reaches the demo scope and the demo
 * principal never reaches anything else.
 */
export function hasAccess(
  db: Db,
  userId: string,
  libraryId: string,
  isAdmin: boolean
): boolean {
  if ((userId === demoUserId(db)) !== inDemoScope(db, libraryId)) return false;
  if (isAdmin) return true;

  const row = db
    .prepare('SELECT 1 FROM user_libraries WHERE user_id = ? AND library_id = ?')
    .get(userId, libraryId);

  return row !== undefined;
}

/**
 * Returns all library IDs the user has access to.
 * Admins get every library.
 */
export function getAllowedLibraryIds(
  db: Db,
  userId: string,
  isAdmin: boolean
): string[] {
  if (isAdmin) {
    const rows = db
      .prepare('SELECT id FROM libraries')
      .all() as { id: string }[];

    return rows.map((r) => r.id).filter((id) => !inDemoScope(db, id));
  }

  const rows = db
    .prepare('SELECT library_id FROM user_libraries WHERE user_id = ?')
    .all(userId) as { library_id: string }[];

  return rows.map((r) => r.library_id);
}

/** Thrown when a grant would put the demo principal and anyone else in one scope. */
export class ScopeError extends Error {}

/**
 * Grant a user access to a library. The demo principal may hold only a library
 * no one else holds or has read in, and no one else may hold one it holds.
 */
export function grantAccess(
  db: Db,
  userId: string,
  libraryId: string
): void {
  const demo = demoUserId(db);
  if (userId === demo) {
    const touched = db
      .prepare(`
        SELECT 1 FROM user_libraries WHERE library_id = ? AND user_id <> ?
        UNION ALL
        SELECT 1 FROM reading_progress p JOIN books b ON b.id = p.book_id
        WHERE b.library_id = ? AND p.user_id <> ?
      `)
      .get(libraryId, userId, libraryId, userId);
    if (touched) throw new ScopeError('The demo principal holds only a library no one else uses.');
  } else if (inDemoScope(db, libraryId)) {
    throw new ScopeError('A library in the demo scope is held by the demo principal alone.');
  }

  db.prepare(`
    INSERT OR IGNORE INTO user_libraries (user_id, library_id) VALUES (?, ?)
  `).run(userId, libraryId);
}

/**
 * Revoke a user's access to a library. Never the demo principal's: its library
 * would leave the demo scope still holding what the demo principal wrote there,
 * so a demo library leaves the scope only by being deleted.
 */
export function revokeAccess(
  db: Db,
  userId: string,
  libraryId: string
): void {
  if (userId === demoUserId(db) && inDemoScope(db, libraryId)) {
    throw new ScopeError('A library leaves the demo scope only by being deleted.');
  }
  db.prepare(
    'DELETE FROM user_libraries WHERE user_id = ? AND library_id = ?'
  ).run(userId, libraryId);
}
