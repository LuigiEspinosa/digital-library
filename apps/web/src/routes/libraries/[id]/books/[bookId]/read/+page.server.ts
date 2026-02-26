import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getBook, getLibrary, getProgress } from '$lib/server/api';

export const load: PageServerLoad = async ({ request, params, parent }) => {
  const { user } = await parent();
  if (!user) redirect(302, '/login');

  const cookie = request.headers.get('cookie') ?? '';

  const [library, book, initialCfi] = await Promise.all([
    getLibrary(cookie, params.id),
    getBook(cookie, params.bookId),
    getProgress(cookie, params.bookId),
  ]);

  if (!library) error(404, 'Library not found.');
  if (!book) error(404, 'Book not found.');

  return { library, book, initialCfi };
};
