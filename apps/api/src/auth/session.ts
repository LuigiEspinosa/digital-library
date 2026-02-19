/**
 * Hand-rolled session management — replaces lucia after deprecation.
 *
 * Design:
 *  - Session IDs are 32 cryptographically random bytes (64 hex chars).
 *  - Stored raw in the sessions table (the table itself has no public exposure).
 *  - Sessions expire after SESSION_MAX_AGE seconds (default 30 days).
 *  - Cookies: httpOnly, sameSite=strict, secure in production — per guide §6.1.
 *  - Sessions are silently extended when past their half-life (lazy extension).
 */

import { randomBytes } from 'node:crypto';
import type { Db } from '../db/connection.js';
import type { User } from '@digital-library/shared';

export const COOKIE_NAME = 'auth_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  /** True if the session was extended during this request */
  fresh: boolean;
}

interface DbSession {
  id: string;
  user_id: string;
  expires_at: number; // UNIX timestamp (seconds)
}

// ---- Core session operations ----

export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

export function createSession(db: Db, userId: string): Session {
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(id, userId, Math.floor(expiresAt.getTime() / 1000));

  return { id, userId, expiresAt, fresh: false };
}

export function validateSession(
  db: Db,
  sessionId: string
): { session: Session; user: User } | { session: null; user: null } {
  const row = db
    .prepare(`
      SELECT s.id, s.user_id, s.expires_at,
             u.id as uid, u.email, u.is_admin, u.kindle_email, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `)
    .get(sessionId) as (DbSession & {
      uid: string; email: string; is_admin: number;
      kindle_email: string | null; created_at: string;
    }) | undefined;

  if (!row) return { session: null, user: null };

  const now = Math.floor(Date.now() / 1000);

  // Expired — delete and reject
  if (row.expires_at < now) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return { session: null, user: null };
  }

  // Lazy extension: if past the halfway point, extend by another full period
  let fresh = false;
  const halfLife = SESSION_MAX_AGE / 2;
  if (row.expires_at - now < halfLife) {
    const newExpiry = now + SESSION_MAX_AGE;
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(newExpiry, sessionId);
    row.expires_at = newExpiry;
    fresh = true;
  }

  const session: Session = {
    id: row.id,
    userId: row.user_id,
    expiresAt: new Date(row.expires_at * 1000),
    fresh,
  };

  const user: User = {
    id: row.uid,
    email: row.email,
    is_admin: row.is_admin === 1,
    kindle_email: row.kindle_email ?? undefined,
    created_at: row.created_at,
  };

  return { session, user };
}

export function invalidateSession(db: Db, sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function invalidateAllUserSessions(db: Db, userId: string): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// ---- Cookie helpers ----

export function buildCookieOptions(expiresAt?: Date) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  };
}

export function blankCookieOptions() {
  return {
    ...buildCookieOptions(new Date(0)), // expired = delete
    maxAge: 0,
  };
}
