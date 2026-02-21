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
};

export async function listUsers(cookie: string): Promise<User[]> {
  try {
    const res = await fetch(`${API_URL}/api/admin/users`, {
      headers: { cookie },
    });

    if (!res.ok) return [];
    return (await res.json()).users ?? [];
  } catch {
    return [];
  }
};

export async function createUser(
  cookie: string,
  data: {
    email: string;
    password: string;
    is_admin: boolean
  }
): Promise<{ user: User } | { error: string }> {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie
    },
    body: JSON.stringify(data),
  });

  const body = await res.json();
  if (!res.ok) return {
    error: body.message ?? 'Failed to create user.',
  }

  return {
    user: body.user,
  };
};

export async function deleteUser(
  cookie: string,
  userId: string,
): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { cookie },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body.message ?? 'Failed to delete user.'
  }

  return null;
};
