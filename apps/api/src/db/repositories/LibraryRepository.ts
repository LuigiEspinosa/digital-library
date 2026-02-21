import type { Db } from "../connection.js";
import type { Library, User } from "@digital-library/shared";

interface CreateLibraryInput {
  name: string;
  description?: string;
}

interface UpdateLibraryInput {
  name?: string;
  description?: string;
}

export class LibraryRepository {
  constructor(private db: Db) { }

  listAll(): Library[] {
    return this.db
      .prepare('SELECT id, name, description, created_at FROM libraries ORDER BY name ASC')
      .all() as Library[];
  }

  listForUser(userId: string): Library[] {
    return this.db
      .prepare(`
        SELECT l.id, l.name, l.description, l.created_at
        FROM libraries l
        INNER JOIN user_libraries ul ON ul.library_id = l.id
        WHERE ul.user_id = ?
        ORDER BY l.name ASC
      `)
      .all(userId) as Library[];
  }

  findById(id: string): Library | null {
    return (
      this.db
        .prepare('SELECT id, name, description, created_at FROM libraries WHERE id = ?')
        .get(id) as Library | undefined
    ) ?? null;
  }

  create(input: CreateLibraryInput): Library {
    const id = crypto.randomUUID();
    this.db
      .prepare('INSERT INTO libraries (id, name, description) VALUES (?, ?, ?)')
      .run(id, input.name, input.description ?? null);
    return this.findById(id)!;
  }

  update(id: string, input: UpdateLibraryInput): Library | null {
    const current = this.findById(id);
    if (!current) return null;
    const name = input.name ?? current.name;
    const description = 'description' in input
      ? (input.description || null)
      : current.description;
    this.db
      .prepare('UPDATE libraries SET name = ?, description = ? WHERE id = ?')
      .run(name, description, id);
    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM libraries WHERE id = ?').run(id);
  }

  getUserCount(libraryId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM user_libraries WHERE library_id = ?')
      .get(libraryId) as { count: number };
    return row.count;
  }

  listUsersWithAccess(libraryId: string): User[] {
    return this.db
      .prepare(`
        SELECT u.id, u.email, u.is_admin, u.kindle_email, u.created_at
        FROM users u
        INNER JOIN user_libraries ul ON ul.user_id = u.id
        WHERE ul.library_id = ?
        ORDER BY u.email ASC
      `)
      .all(libraryId) as User[];
  }
}
