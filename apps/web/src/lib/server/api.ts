import type { Library, User } from '@digital-library/shared';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://api:4000';

export type LibraryWithCount = Library & { user_count: number };

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

export async function listLibraries(cookie: string): Promise<Library[]> {
  try {
    const res = await fetch(`${API_URL}/api/libraries`, { headers: { cookie } });
    if (!res.ok) return [];
    return (await res.json()).data ?? [];
  } catch {
    return [];
  }
}

export async function adminListLibraries(cookie: string): Promise<LibraryWithCount[]> {
  try {
    const res = await fetch(`${API_URL}/api/admin/libraries`, { headers: { cookie } });
    if (!res.ok) return [];
    return (await res.json()).libraries ?? [];
  } catch {
    return [];
  }
}

export async function adminGetLibrary(cookie: string, id: string): Promise<Library | null> {
  try {
    const res = await fetch(`${API_URL}/api/admin/libraries/${id}`, { headers: { cookie } });
    if (!res.ok) return null;
    return (await res.json()).library ?? null;
  } catch {
    return null;
  }
}

export async function adminCreateLibrary(
  cookie: string,
  data: { name: string; description?: string }
): Promise<{ library: Library } | { error: string }> {
  const res = await fetch(`${API_URL}/api/admin/libraries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) return { error: body.message ?? 'Failed to create library.' };
  return { library: body.library };
}

export async function adminUpdateLibrary(
  cookie: string,
  id: string,
  data: { name?: string; description?: string }
): Promise<{ library: Library } | { error: string }> {
  const res = await fetch(`${API_URL}/api/admin/libraries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) return { error: body.message ?? 'Failed to update library.' };
  return { library: body.library };
}

export async function adminDeleteLibrary(cookie: string, id: string): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/admin/libraries/${id}`, {
    method: 'DELETE',
    headers: { cookie },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body.message ?? 'Failed to delete library.';
  }
  return null;
}

export async function adminListLibraryUsers(cookie: string, libraryId: string): Promise<User[]> {
  try {
    const res = await fetch(`${API_URL}/api/admin/libraries/${libraryId}/users`, {
      headers: { cookie },
    });
    if (!res.ok) return [];
    return (await res.json()).users ?? [];
  } catch {
    return [];
  }
}

export async function adminGrantAccess(
  cookie: string,
  userId: string,
  libraryId: string
): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}/libraries/${libraryId}`, {
    method: 'PUT',
    headers: { cookie },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body.message ?? 'Failed to grant access.';
  }
  return null;
}

export async function adminRevokeAccess(
  cookie: string,
  userId: string,
  libraryId: string
): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}/libraries/${libraryId}`, {
    method: 'DELETE',
    headers: { cookie },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body.message ?? 'Failed to revoke access.';
  }
  return null;
}
