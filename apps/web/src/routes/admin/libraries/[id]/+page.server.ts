import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  adminGetLibrary,
  adminUpdateLibrary,
  adminListLibraryUsers,
  adminGrantAccess,
  adminRevokeAccess,
  listUsers,
} from '$lib/server/api';

export const load: PageServerLoad = async ({ request, params }) => {
  const cookie = request.headers.get('cookie') ?? '';
  const [library, libraryUsers, allUsers] = await Promise.all([
    adminGetLibrary(cookie, params.id),
    adminListLibraryUsers(cookie, params.id),
    listUsers(cookie),
  ]);

  if (!library) error(404, 'Library not found.');

  return { library, libraryUsers, allUsers };
};

export const actions: Actions = {
  update: async ({ request, params }) => {
    const cookie = request.headers.get('cookie') ?? '';
    const form = await request.formData();
    const name = form.get('name')?.toString().trim() ?? '';
    const description = form.get('description')?.toString().trim() || undefined;

    if (!name) return fail(400, { updateError: 'Name is required.' });

    const result = await adminUpdateLibrary(cookie, params.id, { name, description });
    if ('error' in result) return fail(400, { updateError: result.error });

    return { updateSuccess: true };
  },

  grant: async ({ request, params }) => {
    const cookie = request.headers.get('cookie') ?? '';
    const form = await request.formData();
    const userId = form.get('userId')?.toString() ?? '';

    if (!userId) return fail(400, { grantError: 'Select a user.' });

    const err = await adminGrantAccess(cookie, userId, params.id);
    if (err) return fail(400, { grantError: err });

    return {};
  },

  revoke: async ({ request, params }) => {
    const cookie = request.headers.get('cookie') ?? '';
    const form = await request.formData();
    const userId = form.get('userId')?.toString() ?? '';

    if (!userId) return fail(400, { revokeError: 'Missing user ID.' });

    const err = await adminRevokeAccess(cookie, userId, params.id);
    if (err) return fail(400, { revokeError: err });

    return {};
  },
};
