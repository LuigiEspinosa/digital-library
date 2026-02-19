import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://api:4000';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const cookie = request.headers.get('cookie') ?? '';

    // Tell the API to invalidate the session server-side
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie },
    }).catch(() => {
      // Even if the API call fails, we clear the cookie locally
    });

    cookies.delete('auth_session', { path: '/' });
    redirect(302, '/login');
  }
}