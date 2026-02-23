import path from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getLibrary, listLibraryBooks } from '$lib/server/api';
import type { Book } from '@digital-library/shared';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://api:4000';

function coverUrl(book: Book): string | undefined {
  if (!book.cover_path) return undefined;
  return `${API_URL}/files/covers/${path.basename(book.cover_path)}`;
}

export const load: PageServerLoad = async ({ request, params, parent }) => {
  const { user } = await parent();
  if (!user) redirect(302, '/login');

  const cookie = request.headers.get('cookie') ?? '';
  const [library, books] = await Promise.all([
    getLibrary(cookie, params.id),
    listLibraryBooks(cookie, params.id),
  ]);

  if (!library) error(404, 'Library not found.');

  return {
    library,
    books: books.map((b) => ({ ...b, coverUrl: coverUrl(b) })),
  };
};

export const actions: Actions = {
  upload: async ({ request, params }) => {
    const cookie = request.headers.get('cookie') ?? '';
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { error: 'No file selected.' });
    }

    const apiForm = new FormData();
    apiForm.append('file', file, file.name);

    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/libraries/${params.id}/books`, {
        method: 'POST',
        headers: { cookie },
        body: apiForm,
      });
    } catch {
      return fail(500, { error: 'Could not react the API.' });
    }

    const body = await res.json();

    if (res.status === 201) return { uploaded: true, book: body.book };
    if (res.status === 409) return { duplicate: true, book: body.book };
    if (res.status === 415) return fail(415, { error: 'Unsupported file format.' });
    if (res.status === 403) return fail(403, { error: 'You do not have upload access to this library.' });

    return fail(res.status, { error: body.message ?? 'Upload failed. ' });
  },
};
