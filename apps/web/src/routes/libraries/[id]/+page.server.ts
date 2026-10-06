import path from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getLibrary, listLibraryBooks, getLibraryFilters } from '$lib/server/api';
import type { Book } from '@digital-library/shared';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://api:4000';
const PAGE_SIZE = 24;

// The URL carries the friendly `comic`; the API gets the concrete stored formats.
// Widening lives in the repository's IN-list — sending `comic` alone matches nothing.
const COMIC_FORMATS = 'cbz,cbr,images';

// Any narrow comic format lights the single COMIC segment, so the data it fetches
// must be the whole comic set too — otherwise the lit segment claims CBR and images
// that were never requested, and re-clicking it is a no-op (FilterStrip ignores a
// no-change select), leaving no way to widen.
const COMIC_ALIASES = new Set(['cbz', 'cbr', 'images', 'comic']);

// An unrecognised value is dropped rather than forwarded: `?format=,` used to parse
// to an empty IN-list and return the WHOLE library while the result bar still
// claimed a filter was active and no segment lit.
const KNOWN_FORMATS = new Set(['epub', 'pdf', 'cbz', 'cbr', 'images', 'comic']);

function coverUrl(book: Book): string | undefined {
  if (!book.cover_path) return undefined;
  return `/files/covers/${path.basename(book.cover_path)}`;
}

export const load: PageServerLoad = async ({ request, params, parent, url }) => {
  const { user } = await parent();
  if (!user) redirect(302, '/login');

  const cookie = request.headers.get('cookie') ?? '';

  const q = url.searchParams.get('q') ?? undefined;
  const rawFormat = url.searchParams.get('format')?.trim().toLowerCase();
  const format = rawFormat && KNOWN_FORMATS.has(rawFormat) ? rawFormat : undefined;
  const author = url.searchParams.get('author') ?? undefined;
  const series = url.searchParams.get('series') ?? undefined;
  const language = url.searchParams.get('language') ?? undefined;
  const tagsParam = url.searchParams.get('tags');
  const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined;
  const sort = url.searchParams.get('sort') ?? 'title';
  const order = url.searchParams.get('order') ?? 'asc';
  // Number(), not parseInt(): `?page=` yields '' (not null, so `??` never fires) and
  // parseInt('') is NaN, which survived Math.max and painted `Showing NaN–NaN of 127`
  // with both pager controls live and offset=NaN forwarded to the API.
  const pageParam = Number(url.searchParams.get('page'));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  // Which segment lights up. A bookmarked ?format=cbz still shows COMIC active.
  const activeFormat = format && COMIC_ALIASES.has(format) ? 'comic' : (format ?? '');

  const apiParams = new URLSearchParams();
  if (q) apiParams.set('q', q);
  if (format) apiParams.set('format', activeFormat === 'comic' ? COMIC_FORMATS : format);
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

  // A page past the end returns zero rows while `total` stays high, so the empty
  // state (which keys on total) never fires and the grid renders blank with an
  // inverted `Showing 2399953–127 of 127`. Land the reader on the last real page
  // instead. Reachable by bookmark, by Back, and by an admin deleting enough books
  // while a reader sits on the last page.
  const lastPage = Math.max(1, Math.ceil(bookResult.total / PAGE_SIZE));
  if (bookResult.total > 0 && page > lastPage) {
    const target = new URL(url);
    target.searchParams.set('page', String(lastPage));
    redirect(302, `${target.pathname}${target.search}`);
  }

  return {
    library,
    books: bookResult.books.map((b) => ({ ...b, coverUrl: coverUrl(b) })),
    total: bookResult.total,
    filterOptions,
    filters: { q, format, author, series, language, tags, sort, order, page },
    // The sort-restore guard reads this rather than importing $app/stores, which
    // keeps the route's client import graph to $app/navigation + $app/forms.
    sortExplicit: url.searchParams.has('sort') || url.searchParams.has('order'),
    activeFormat,
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
