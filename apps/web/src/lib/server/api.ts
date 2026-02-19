import type { User } from '@digital-library/shared';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://api:4000';

/**
 * Fetch the current user from the API, forwarding the session cookie.
 * Used in server load functions so SSR has the auth state.
 * Returns null if the cookie is missing or the session is invalid.
 */
export async function getSessionUser(cookie: string): Promise<User | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { cookie },
    });

    if (!res.ok) return null;
    const body = await res.json();
    return body.user ?? null;
  } catch {
    return null;
  }
}
