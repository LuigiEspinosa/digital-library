import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from './$types';
import { listUsers, createUser, deleteUser } from "$lib/server/api";

export const load: PageServerLoad = async ({ request }) => {
  const cookie = request.headers.get('cookie') ?? '';
  const users = await listUsers(cookie);
  return { users };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const cookie = request.headers.get('cookie') ?? '';
    const form = await request.formData();
    const email = form.get('email')?.toString().trim() ?? '';
    const password = form.get('password')?.toString() ?? '';
    const is_admin = form.get('is_admin') === 'on';

    if (!email || !password) {
      return fail(400, {
        createError: 'Email and password are required.',
        email,
      });
    }

    if (password.length < 8) {
      return fail(400, {
        createError: 'Password must be at least 8 characters.',
        email,
      });
    }

    const result = await createUser(cookie, {
      email,
      password,
      is_admin,
    });

    if ('error' in result) {
      return fail(400, {
        createError: result.error,
        email,
      });
    }

    return { success: true };
  },

  delete: async ({ request }) => {
    const cookie = request.headers.get('cookie') ?? '';
    const form = await request.formData();
    const userId = form.get('userId')?.toString() ?? '';

    if (!userId) return fail(400, {
      deleteError: 'Missing user ID.'
    });

    const error = await deleteUser(cookie, userId);
    if (error) return fail(400, { deleteError: error });
  },
};
