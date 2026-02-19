import { generateIdFromEntropySize } from 'lucia';
import { hash, verify } from '@node-rs/argon2';
import type { Db } from '../connection.js';
import type { User } from '@digital-library/shared';

// Recommended minimum Argon2id parameters from lucia v3 docs
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

interface DbUser {
  id: string;
  email: string;
  hashed_password: string;
  is_admin: number; // SQLite stores booleans as 0 | 1
  kindle_email: string | null;
  created_at: string;
}

function toUser(row: DbUser): User {
  return {
    id: row.id,
    email: row.email,
    is_admin: row.is_admin === 1,
    kindle_email: row.kindle_email ?? undefined,
    created_at: row.created_at,
  };
}

export class UserRepository {
  constructor(private db: Db) { }

  findById(id: string): User | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE = id = ?')
      .get(id) as DbUser | undefined;

    return row ? toUser(row) : null;
  }

  findByEmail(email: string): (DbUser) | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase().trim()) as DbUser | undefined;

    return row ?? null;
  }

  listAll(): User[] {
    const rows = this.db
      .prepare('SELECT * FROM users ORDER BY created_at ASC')
      .all() as DbUser[];

    return rows.map(toUser);
  }

  async create(opts: {
    email: string;
    password: string;
    is_admin?: boolean;
  }): Promise<User> {
    const id = generateIdFromEntropySize(10); // 16 character secure random ID
    const hashed_password = await hash(opts.password, ARGON2_OPTIONS);

    this.db.prepare(`
      INSERT INTO users (id, email, hashed_password, is_admin)
      VALUES (?, ?, ?, ?)
    `).run(
      id,
      opts.email.toLowerCase().trim(),
      hashed_password,
      opts.is_admin ? 1 : 0
    );

    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  /**
   * Verify a plaintext password. Returns the User on success, null on failure.
   * Always run the full hash comparison to prevent timing attacks,
   * even when no user is found, we hash anyway so the response time is constant.
   */
  async verifyPassword(email: string, password: string): Promise<User | null> {
    const row = this.findByEmail(email);

    if (!row) {
      // Dummy hash to keep response time constant
      await hash(password, ARGON2_OPTIONS);
      return null;
    }

    const valid = await verify(row.hashed_password, password, ARGON2_OPTIONS);
    if (!valid) return null;

    return toUser(row);
  }

  /**
   * True when the users table is empty,
   * used to seed the first admin.
   */
  isEmpty(): boolean {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM users')
      .get() as { count: number };

    return row.count === 0;
  }
}
