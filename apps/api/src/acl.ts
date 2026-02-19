import type { Db } from "./db/connection.js";

/**
 * Returns true if the user has access to the library.
 * Admin users bypass all ACL checks.
 */
export function hasAccess(
  db: Db,
  userId: string,
  libraryId: string,
  isAdmin: boolean
): boolean {
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

    return rows.map((r) => r.id);
  }

  const rows = db
    .prepare('SELECT library_id FROM user_libraries WHERE user_id = ?')
    .all(userId) as { library_id: string }[];

  return rows.map((r) => r.library_id);
}

/** Grant a user access to a library. */
export function grantAccess(
  db: Db,
  userId: string,
  libraryId: string
): void {
  db.prepare(`
    INSERT OR IGNORE INTO user_libraries (user_id, library_id) VALUES (?, ?)
  `).run(userId, libraryId);
}

/** Revoke a user's access to a library. */
export function revokeAccess(
  db: Db,
  userId: string,
  libraryId: string
): void {
  db.prepare(
    'DELETE FROM user_libraries WHERE user_id = ? AND library_id = ?'
  ).run(userId, libraryId);
}
