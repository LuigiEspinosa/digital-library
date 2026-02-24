import path from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getLibrary, listLibraryBooks, getLibraryFilters } from '$lib/server/api';
import type { Book } from '@digital-library/shared';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://api:4000';
const PAGE_SIZE = 24;

function coverUrl(book: Book): string | undefined {
  if (!book.cover_path) return undefined;
  return `/files/covers/${path.basename(book.cover_path)}`;
}

export const load: PageServerLoad = async ({ request, params, parent, url }) => {
  const { user } = await parent();
  if (!user) redirect(302, '/login');

  const cookie = request.headers.get('cookie') ?? '';

  const q = url.searchParams.get('q') ?? undefined;
  const format = url.searchParams.get('format') ?? undefined;
  const author = url.searchParams.get('author') ?? undefined;
  const series = url.searchParams.get('series') ?? undefined;
  const language = url.searchParams.get('language') ?? undefined;
  const tagsParam = url.searchParams.get('tags');
  const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined;
  const sort = url.searchParams.get('sort') ?? 'title';
  const order = url.searchParams.get('order') ?? 'asc';
  const view = url.searchParams.get('view') === 'list' ? 'list' : 'grid';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const apiParams = new URLSearchParams();
  if (q) apiParams.set('q', q);
  if (format) apiParams.set('format', format);
  if (author) apiParams.set('author', author);
  if (series) apiParams.set('series', series);
  if (language) apiParams.set('language', language);
  if (tags?.length) apiParams.set('tags', tags.join(','));
  if (sort !== 'title') apiParams.set('sort', sort);
  if (order !== 'asc') apiParams.set('order', order);
  apiParams.set('limit', String(PAGE_SIZE));
  apiParams.set('offset', String(offset));

  const [library, bookResult, filterOptions] = await Promise.all([
    getLibrary(cookie, params.id),
    listLibraryBooks(cookie, params.id, apiParams),
    getLibraryFilters(cookie, params.id),
  ]);

  if (!library) error(404, 'Library not found.');

  return {
    library,
    books: bookResult.books.map((b) => ({ ...b, coverUrl: coverUrl(b) })),
    total: bookResult.total,
    filterOptions,
    filters: { q, format, author, series, language, tags, sort, order, view, page },
    pageSize: PAGE_SIZE
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

  delete: async ({ request }) => {
    const cookie = request.headers.get('cookie') ?? '';
    const formData = await request.formData();
    const bookId = formData.get('bookId')?.toString();
    if (!bookId) return fail(400, { error: 'Missing book ID. ' });

    const res = await fetch(`${API_URL}/api/books/${bookId}`, {
      method: 'DELETE',
      headers: { cookie },
    });

    if (res.status !== 204) {
      const body = await res.json().catch(() => ({}));
      return fail(res.status, { error: body.message ?? 'Delete failed.' });
    }

    return { deleted: true };
  },
};
