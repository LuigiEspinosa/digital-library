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

// The one way a stored email is recognised, in SQL: trimmed and lowercased, as
// isDemoPrincipal compares it, so a row written by hand in another casing is still
// the demo principal (Epic 5 retrospective m13). SQLite's lower() and trim() fold
// only ASCII case and spaces, which is all the address holds.
const DEMO_EMAIL = 'lower(trim(email)) = ?';

/** Every account that is the demo principal: one, or none while demo access is off. */
export function demoAccounts(db: Db): { id: string; is_admin: boolean }[] {
  const rows = db.prepare(`SELECT id, is_admin FROM users WHERE ${DEMO_EMAIL}`).all(DEMO_PRINCIPAL) as {
    id: string;
    is_admin: number;
  }[];
  return rows.map((r) => ({ id: r.id, is_admin: r.is_admin === 1 }));
}

function isDemoUser(db: Db, userId: string): boolean {
  return db.prepare(`SELECT 1 FROM users WHERE id = ? AND ${DEMO_EMAIL}`).get(userId, DEMO_PRINCIPAL) !== undefined;
}

/** True when the library is in the demo principal's scope. */
export function inDemoScope(db: Db, libraryId: string): boolean {
  return (
    db
      .prepare(`SELECT 1 FROM user_libraries WHERE library_id = ? AND user_id IN (SELECT id FROM users WHERE ${DEMO_EMAIL})`)
      .get(libraryId, DEMO_PRINCIPAL) !== undefined
  );
}

/**
 * Returns true if the user has access to the library.
 * Admin users bypass all ACL checks, except the scope boundary: no one reaches
 * across it, so the Operator never reaches the demo scope and the demo
 * principal never reaches anything else. The demo principal never takes the
 * admin bypass, even with is_admin set by hand.
 */
export function hasAccess(
  db: Db,
  userId: string,
  libraryId: string,
  isAdmin: boolean
): boolean {
  const demo = isDemoUser(db, userId);
  if (demo !== inDemoScope(db, libraryId)) return false;
  if (isAdmin && !demo) return true;

  const row = db
    .prepare('SELECT 1 FROM user_libraries WHERE user_id = ? AND library_id = ?')
    .get(userId, libraryId);

  return row !== undefined;
}

/**
 * Returns all library IDs the user has access to.
 * Admins get every library outside the demo scope; the demo principal is never
 * treated as an admin.
 */
export function getAllowedLibraryIds(
  db: Db,
  userId: string,
  isAdmin: boolean
): string[] {
  if (isAdmin && !isDemoUser(db, userId)) {
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
  if (isDemoUser(db, userId)) {
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
  if (isDemoUser(db, userId) && inDemoScope(db, libraryId)) {
    throw new ScopeError('A library leaves the demo scope only by being deleted.');
  }
  db.prepare(
    'DELETE FROM user_libraries WHERE user_id = ? AND library_id = ?'
  ).run(userId, libraryId);
}
