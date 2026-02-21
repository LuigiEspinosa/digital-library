import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listLibraries } from '$lib/server/api';

export const load: PageServerLoad = async ({ parent, request }) => {
  const { user } = await parent();
  if (!user) redirect(302, '/login');
  const cookie = request.headers.get('cookie') ?? '';
  const libraries = await listLibraries(cookie);
  return { libraries };
};
