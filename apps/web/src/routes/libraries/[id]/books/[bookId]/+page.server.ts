import path from 'node:path';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBook, getLibrary } from '$lib/server/api';
import type { Book } from '@digital-library/shared';

function coverUrl(book: Book): string | undefined {
  if (!book.cover_path) return undefined;
  return `/files/covers/${path.basename(book.cover_path)}`;
}

export const load: PageServerLoad = async ({ request, params, parent }) => {
  const { user } = await parent();
  if (!user) redirect(302, '/login');

  const cookie = request.headers.get('cookie') ?? '';

  const [library, book] = await Promise.all([
    getLibrary(cookie, params.id),
    getBook(cookie, params.bookId),
  ]);

  if (!library) error(404, 'Library not found.');
  if (!book) error(404, 'Book not found.');

  return {
    library,
    book: { ...book, coverUrl: coverUrl(book) },
  };
};
