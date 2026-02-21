import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

const API_URL = process.env.PUBLIC_API_URL ?? 'http://api:4000';

// If already logged in, redirect to home
export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  if (user) redirect(302, '/');
  return {};
}

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const email = form.get('email')?.toString().trim() ?? '';
    const password = form.get('password')?.toString() ?? '';

    if (!email || !password) {
      return fail(400, { error: 'Email and password are required', email });
    }

    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      return fail(500, { error: 'Could not reach the server', email });
    }

    if (!res.ok) {
      return fail(401, { error: 'Invalid email or password', email });
    }

    // The API sets Set-Cookie on its response. We forward it to the browser
    // by reading it here and re-setting it on the SvelteKit response.
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      // Parse the auth_session cookie value and attributes out of the header
      // and relay it as a SvelteKit cookie so the browser stores it.
      const [nameValue, ...directives] = setCookie.split(';').map((s) => s.trim());
      const [name, value] = nameValue.split('=');

      const maxAge = directives.find((d) => d.toLowerCase().startsWith('max-age='));
      const path = directives.find((d) => d.toLowerCase().startsWith('path='));

      cookies.set(name, value, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: path ? path.split('=')[1] : '/',
        maxAge: maxAge ? parseInt(maxAge.split('=')[1]) : undefined,
      });
    }

    redirect(302, '/');
  },
}