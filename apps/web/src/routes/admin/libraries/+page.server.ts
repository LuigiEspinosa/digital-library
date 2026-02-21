import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { adminListLibraries, adminCreateLibrary, adminDeleteLibrary } from '$lib/server/api';

export const load: PageServerLoad = async ({ request }) => {
  const cookie = request.headers.get('cookie') ?? '';
  const libraries = await adminListLibraries(cookie);
  return { libraries };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const cookie = request.headers.get('cookie') ?? '';
    const form = await request.formData();
    const name = form.get('name')?.toString().trim() ?? '';
    const description = form.get('description')?.toString().trim() || undefined;

    if (!name) return fail(400, { createError: 'Name is required.', name: '', description });

    const result = await adminCreateLibrary(cookie, { name, description });
    if ('error' in result) return fail(400, { createError: result.error, name, description });

    return { success: true };
  },

  delete: async ({ request }) => {
    const cookie = request.headers.get('cookie') ?? '';
    const form = await request.formData();
    const id = form.get('id')?.toString() ?? '';

    if (!id) return fail(400, { deleteError: 'Missing library ID.' });

    const error = await adminDeleteLibrary(cookie, id);
    if (error) return fail(400, { deleteError: error });
  },
};
