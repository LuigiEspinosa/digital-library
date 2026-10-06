import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import GridPage from '../+page.svelte';
import { load } from '../+page.server';
import { getLibrary, listLibraryBooks, getLibraryFilters } from '$lib/server/api';
import type { BookWithProgress } from '@digital-library/shared';

// Resolved in two steps on purpose: a literal `new URL('../+page.svelte',
// import.meta.url)` is Vite's asset-URL pattern and gets rewritten to an
// http://localhost asset path, which fileURLToPath then rejects.
const pageSource = join(dirname(fileURLToPath(import.meta.url)), '../+page.svelte');

// This file lives in __tests__/ rather than beside the route as +page.test.ts:
// that filename is picked up by svelte-kit sync as a route file and breaks it
// (Epic 01 A.4 lost a test to it). A subdirectory holding no +page.* declares
// no route.
//
// jsdom does no layout and does not compute Svelte scoped <style>, so the 4-column
// grid, the column folds, the hover title swap and the sort-box inversion are all
// visual-check items — asserting them here would pass vacuously (getComputedStyle
// returns empty strings). What IS testable: structure, link targets, derived copy,
// and — for the palette/fold/no-chrome ACs — the route source itself (last describe).

// Aliased to the REAL payload type plus the load's computed coverUrl, rather than
// re-declared: a hand-written parallel shape stays green when the API stops sending
// a field, which is the one regression a fixture type exists to catch.
type TileBook = BookWithProgress & { coverUrl?: string };

function book(overrides: Partial<TileBook> = {}): TileBook {
	return {
		id: 'bk-1',
		library_id: 'lib-1',
		title: 'Exhalation',
		author: 'Ted Chiang',
		format: 'epub',
		file_path: '/books/exhalation.epub',
		published_at: '2019-05-07',
		created_at: '2026-08-14 10:00:00',
		progress_position: null,
		...overrides
	};
}

const reader = { id: 'u1', email: 'luigi@pharosgraph.com', is_admin: false, created_at: '' };
const admin = { ...reader, id: 'u2', email: 'admin@localhost.local', is_admin: true };

type Filters = {
	q?: string;
	format?: string;
	author?: string;
	series?: string;
	language?: string;
	tags?: string[];
	sort: string;
	order: string;
	page: number;
};

function pageData(overrides: Record<string, unknown> = {}) {
	const filters: Filters = { sort: 'title', order: 'asc', page: 1 };
	return {
		library: { id: 'lib-1', name: 'Fiction', created_at: '2026-01-04 09:00:00' },
		books: [] as TileBook[],
		total: 0,
		filterOptions: { formats: [], authors: [], series: [], languages: [], tags: [] },
		filters,
		sortExplicit: false,
		activeFormat: '',
		pageSize: 24,
		user: reader,
		...overrides
	};
}

function renderPage(overrides: Record<string, unknown> = {}) {
	return render(GridPage, { data: pageData(overrides), form: null } as never);
}

describe('/libraries/[id] — the grid', () => {
	const two = [
		book(),
		book({ id: 'bk-2', title: 'Piranesi', author: 'Susanna Clarke', format: 'pdf' })
	];

	test('renders one tile per book, each titled with a link to the book', () => {
		const { container } = renderPage({ books: two, total: 2 });

		expect(container.querySelectorAll('.tile')).toHaveLength(2);
		const hrefs = [...container.querySelectorAll('.tile a.title')].map((a) =>
			a.getAttribute('href')
		);
		expect(hrefs).toEqual(['/libraries/lib-1/books/bk-1', '/libraries/lib-1/books/bk-2']);
	});

	// Two links to the same href would be two tab stops announcing the same name.
	test('the cover link is hidden from assistive tech; the title link is not', () => {
		const { container } = renderPage({ books: [book()], total: 1 });

		const cover = container.querySelector('.tile a.cover-link');
		expect(cover?.getAttribute('tabindex')).toBe('-1');
		expect(cover?.getAttribute('aria-hidden')).toBe('true');

		const title = container.querySelector('.tile a.title');
		expect(title?.getAttribute('tabindex')).toBeNull();
		expect(title?.getAttribute('aria-hidden')).toBeNull();
	});

	test('the tile kicker names the format and the publication year', () => {
		const { container } = renderPage({ books: [book()], total: 1 });
		expect(container.querySelector('.kicker')?.textContent).toBe('EPUB · 2019');
	});

	// The year half is omitted whole rather than printed as a placeholder, so no
	// trailing separator is left behind.
	test('a book with no publication date renders the format alone', () => {
		const { container } = renderPage({
			books: [book({ published_at: undefined })],
			total: 1
		});
		const kicker = container.querySelector('.kicker')?.textContent;
		expect(kicker).toBe('EPUB');
		expect(kicker).not.toContain('·');
	});

	test('a book with no author renders no author line at all', () => {
		const { container } = renderPage({ books: [book({ author: undefined })], total: 1 });
		expect(container.querySelector('.author')).toBeNull();
	});

	test('an authored book renders the whole line, including the name', () => {
		const { container } = renderPage({ books: [book()], total: 1 });
		expect(container.querySelector('.author')?.textContent?.trim()).toBe('by Ted Chiang');
	});

	test('a book with a cover renders a lazy image with no duplicate alt text', () => {
		const { container } = renderPage({
			books: [book({ coverUrl: '/files/covers/exhalation.jpg' })],
			total: 1
		});

		const img = container.querySelector('.cover img');
		expect(img?.getAttribute('src')).toBe('/files/covers/exhalation.jpg');
		expect(img?.getAttribute('loading')).toBe('lazy');
		expect(img?.getAttribute('alt')).toBe('');
		expect(container.querySelector('.fallback')).toBeNull();
	});

	test('a book with no cover renders the fallback block and no image', () => {
		const { container } = renderPage({ books: [book()], total: 1 });

		const fallback = container.querySelector('.cover.fallback');
		expect(fallback).not.toBeNull();
		expect(container.querySelector('img')).toBeNull();
		expect(fallback?.textContent).toContain('EPUB · N° 01');
		expect(fallback?.querySelector('.fallback-title')?.textContent).toBe('Exhalation');
	});

	// The four rows of AC3 that a reader can actually reach today, on one page.
	test('renders the per-format progress label for a mixed shelf', () => {
		const books = [
			book({ id: 'a', progress_position: null }),
			book({ id: 'b', format: 'epub', progress_position: 'epubcfi(/6/14!/4/2)' }),
			book({ id: 'c', format: 'pdf', page_count: 288, progress_position: '121' }),
			book({ id: 'd', format: 'pdf', page_count: 288, progress_position: '288' })
		];
		const { container } = renderPage({ books, total: 4 });

		const labels = [...container.querySelectorAll('.progress')].map((p) => p.textContent?.trim());
		expect(labels).toEqual(['Unread', 'Reading', 'Reading · 42%', 'Finished']);
	});
});

describe('/libraries/[id] — filter strip and result bar', () => {
	test('the active format segment is the one marked pressed', () => {
		const { container } = renderPage();
		const pressed = container.querySelector('[aria-pressed="true"]');
		expect(pressed?.textContent?.trim()).toBe('All formats');
	});

	// Renders whatever activeFormat the load computed — the cbz → comic DERIVATION
	// is the load's job and is asserted against the real load below, not here.
	// Supplying activeFormat AND filters.format to this test would let it claim a
	// derivation it never exercises.
	test('the Comic segment lights from activeFormat', () => {
		const { container } = renderPage({ activeFormat: 'comic' });
		expect(container.querySelector('[aria-pressed="true"]')?.textContent?.trim()).toBe('Comic');
	});

	test('the search field is labelled and seeded from the URL', () => {
		const { container } = renderPage({
			filters: { q: 'chiang', sort: 'title', order: 'asc', page: 1 },
			books: [book()],
			total: 1
		});

		const input = container.querySelector<HTMLInputElement>('.search input[type="search"]');
		expect(input?.getAttribute('aria-label')).toBe('Search this library');
		expect(input?.value).toBe('chiang');
	});

	test('the result bar counts the current page against the total', () => {
		const { container } = renderPage({ books: [book()], total: 127 });
		expect(container.querySelector('.resultbar .mono-kicker')?.textContent).toBe(
			'Showing 1–24 of 127 · All formats'
		);
	});

	test('the result bar names the active format and the live query', () => {
		const { container } = renderPage({
			books: [book()],
			total: 3,
			activeFormat: 'comic',
			filters: { q: 'atlas', format: 'comic', sort: 'title', order: 'asc', page: 1 }
		});
		expect(container.querySelector('.resultbar .mono-kicker')?.textContent).toBe(
			'Showing 1–3 of 3 · Format Comic · “atlas”'
		);
	});

	// A 1–0 of 0 range is worse than saying nothing matched.
	test('an empty result set reads as No results, not a zero range', () => {
		const { container } = renderPage({ total: 0 });
		expect(container.querySelector('.resultbar .mono-kicker')?.textContent).toBe('No results');
	});

	test('the sort control offers exactly the five specified options', () => {
		const { container } = renderPage();
		const values = [...container.querySelectorAll('#library-sort option')].map(
			(o) => (o as HTMLOptionElement).value
		);
		expect(values).toEqual(['title-az', 'title-za', 'author', 'newest', 'oldest']);
	});

	test('the sort control reflects the sort and order in the URL', () => {
		const { container } = renderPage({
			filters: { sort: 'created_at', order: 'desc', page: 1 }
		});
		expect(container.querySelector<HTMLSelectElement>('#library-sort')?.value).toBe('newest');
	});

	test('the sort control is labelled', () => {
		const { container } = renderPage();
		expect(container.querySelector('label[for="library-sort"]')?.textContent).toBe('Sort by');
	});
});

describe('/libraries/[id] — pagination', () => {
	test('does not render for a single page', () => {
		const { container } = renderPage({ books: [book()], total: 12 });
		expect(container.querySelector('.pagination')).toBeNull();
	});

	test('disables Prev on the first page', () => {
		const { container } = renderPage({ books: [book()], total: 127 });

		const controls = [...container.querySelectorAll('.pagination a')];
		expect(controls.map((a) => a.textContent?.trim())).toEqual(['Prev', 'Next']);
		expect(controls[0].getAttribute('aria-disabled')).toBe('true');
		expect(controls[0].getAttribute('href')).toBeNull();
		expect(controls[1].getAttribute('aria-disabled')).toBeNull();
	});

	test('disables Next on the last page', () => {
		const { container } = renderPage({
			books: [book()],
			total: 127,
			filters: { sort: 'title', order: 'asc', page: 6 }
		});

		const controls = [...container.querySelectorAll('.pagination a')];
		expect(controls[0].getAttribute('aria-disabled')).toBeNull();
		expect(controls[1].getAttribute('aria-disabled')).toBe('true');
	});

	test('the page indicator is zero-padded', () => {
		const { container } = renderPage({ books: [book()], total: 127 });
		expect(container.querySelector('.page-indicator')?.textContent?.trim()).toBe('Page 01 of 06');
	});
});

describe('/libraries/[id] — empty states', () => {
	test('an empty library says so, and offers no Clear filters escape', () => {
		const { container } = renderPage({ total: 0 });

		const empty = container.querySelector('.empty');
		expect(empty?.querySelector('.mono-kicker')?.textContent).toBe('Nothing on file');
		expect(empty?.querySelector('.empty-headline')?.textContent).toBe('This library is empty.');
		expect(empty?.querySelector('.empty-cta')).toBeNull();
	});

	test('the empty-library body differs for an admin and a reader', () => {
		const asAdmin = renderPage({ total: 0, user: admin });
		expect(asAdmin.container.querySelector('.empty-body')?.textContent).toContain(
			'watched folder'
		);

		const asReader = renderPage({ total: 0 });
		const body = asReader.container.querySelector('.empty-body')?.textContent ?? '';
		expect(body).toContain('No books have been added');
		expect(body).not.toContain('watched folder');
	});

	// A hand-typed ?author= that matches nothing must reach this arm rather than
	// claiming the library itself is empty — hence the filter check spans the four
	// params that have no UI on this screen.
	test('a query that matches nothing offers a real link back to the bare route', () => {
		const { container } = renderPage({
			total: 0,
			filters: { q: 'nothing here', sort: 'title', order: 'asc', page: 1 }
		});

		const empty = container.querySelector('.empty');
		expect(empty?.querySelector('.mono-kicker')?.textContent).toBe('No results');
		expect(empty?.querySelector('.empty-headline')?.textContent).toBe(
			'Nothing matches that query.'
		);

		const cta = empty?.querySelector('.empty-cta a');
		expect(cta?.textContent?.trim()).toBe('Clear filters');
		expect(cta?.getAttribute('href')).toBe('/libraries/lib-1');
	});

	test('a UI-less filter still reaches the no-results arm', () => {
		const { container } = renderPage({
			total: 0,
			filters: { author: 'Nobody At All', sort: 'title', order: 'asc', page: 1 }
		});
		expect(container.querySelector('.empty .mono-kicker')?.textContent).toBe('No results');
	});

	test('the two arms never render together', () => {
		for (const filters of [
			{ sort: 'title', order: 'asc', page: 1 },
			{ q: 'x', sort: 'title', order: 'asc', page: 1 }
		]) {
			const { container } = renderPage({ total: 0, filters });
			expect(container.querySelectorAll('.empty-headline')).toHaveLength(1);
		}
	});
});

describe('/libraries/[id] — admin affordances', () => {
	test('a reader is offered neither upload nor remove', () => {
		const { container } = renderPage({ books: [book()], total: 1 });

		const text = container.textContent ?? '';
		expect(text).not.toContain('Upload a file');
		expect(container.querySelectorAll('.tile-remove')).toHaveLength(0);
	});

	test('an admin gets the upload toggle and one Remove per tile', () => {
		const { container } = renderPage({
			books: [book(), book({ id: 'bk-2', title: 'Piranesi' })],
			total: 2,
			user: admin
		});

		const toggle = [...container.querySelectorAll('.resultbar-right button')].map((b) =>
			b.textContent?.trim()
		);
		expect(toggle).toContain('Upload a file');

		const removes = [...container.querySelectorAll('.tile-remove')];
		expect(removes).toHaveLength(2);
		expect(removes[0].getAttribute('action')).toBe('?/delete');
		expect(removes[0].querySelector('input[name="bookId"]')?.getAttribute('value')).toBe('bk-1');
		expect(removes[0].querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Remove');
	});

	// The remove form is a SIBLING of the cover and title links, never nested inside
	// one — a form inside an anchor is invalid and swallows the submit.
	test('the remove form is not nested inside a link', () => {
		const { container } = renderPage({ books: [book()], total: 1, user: admin });
		expect(container.querySelector('a .tile-remove')).toBeNull();
	});

	test('the upload panel stays closed until the toggle is used', () => {
		const { container } = renderPage({ books: [book()], total: 1, user: admin });
		expect(container.querySelector('form[action="?/upload"]')).toBeNull();
	});
});

describe('/libraries/[id] — shell', () => {
	test('the breadcrumb carries the library name as its third segment', () => {
		const { container } = renderPage({ books: [book()], total: 1 });
		const crumbs = [...container.querySelectorAll('.utility-left .crumb')].map(
			(c) => c.textContent
		);
		expect(crumbs).toEqual(['Cuatro Library', 'Libraries', 'Fiction']);
	});

	test('the email carries the hook that unshouts it and hides it on mobile', () => {
		const { container } = renderPage();
		expect(container.querySelector('.utility-right span.session-email')?.textContent).toBe(
			'luigi@pharosgraph.com'
		);
	});

	test('keeps the sign-out POST form the logout route reads', () => {
		const { container } = renderPage();
		const form = container.querySelector('form[action="/logout"]');
		expect(form?.getAttribute('method')?.toUpperCase()).toBe('POST');
		expect(form?.querySelector('button[type="submit"]')?.textContent).toBe('Sign out');
	});

	test('renders the two round nav icons with accessible names', () => {
		const { container } = renderPage();
		const labels = [...container.querySelectorAll('.round-icon-btn')].map((b) =>
			b.getAttribute('aria-label')
		);
		expect(labels).toEqual(['Search', 'Account']);
	});

	test('renders the page head and the footer, admin-aware', () => {
		const { container } = renderPage({ books: [book()], total: 127 });
		expect(container.querySelector('.page-head .mono-kicker')?.textContent).toBe('Library');
		expect(container.querySelector('h1.hero')?.textContent).toBe('Fiction');
		expect(container.querySelector('.footer')).not.toBeNull();
		expect(container.querySelector('.footer a[href="/admin"]')).toBeNull();

		const asAdmin = renderPage({ books: [book()], total: 127, user: admin });
		expect(asAdmin.container.querySelector('.footer a[href="/admin"]')).not.toBeNull();
	});

	test('the deck counts the books and names the newest import', () => {
		const { container } = renderPage({ books: [book()], total: 127 });
		const deck = container.querySelector('.deck')?.textContent?.replace(/\s+/g, ' ').trim();
		expect(deck).toContain('127 Books');
		expect(deck).toContain('last imported');
	});

	// With nothing on the page carrying a stamp there is no import clause to render,
	// and a placeholder would be worse than its absence.
	test('the deck drops the import clause when no rendered book has a stamp', () => {
		const { container } = renderPage({
			books: [book({ created_at: '' })],
			total: 1
		});
		const deck = container.querySelector('.deck')?.textContent?.replace(/\s+/g, ' ').trim();
		expect(deck).toBe('1 Book');
	});
});

// Author-casing is the Epic 03 convention: MonoKicker, UtilityBar, Footer's links
// and Button all uppercase in CSS, so the rendered pixels are identical while the
// DOM text a screen reader announces keeps real casing. These assertions are what
// pin it — a .toUpperCase() creeping into the markup turns them red.
describe('/libraries/[id] — author-cased copy', () => {
	test('never pre-shouts a string in the markup', () => {
		const { container } = renderPage({
			books: [book({ format: 'pdf', page_count: 288, progress_position: '121' }), book({ id: 'z' })],
			total: 127,
			user: admin
		});
		const text = container.textContent ?? '';

		expect(text).toContain('Library');
		expect(text).toContain('Showing 1–24 of 127');
		expect(text).toContain('All formats');
		expect(text).toContain('Sort by');
		expect(text).toContain('Title A–Z');
		expect(text).toContain('Page 01 of 06');
		expect(text).toContain('Unread');
		expect(text).toContain('Reading · 42%');
		expect(text).toContain('Prev');
		expect(text).toContain('Upload a file');
		expect(text).toContain('Remove');

		expect(text).not.toContain('SHOWING');
		expect(text).not.toContain('ALL FORMATS');
		expect(text).not.toContain('SORT BY');
		expect(text).not.toContain('UNREAD');
		expect(text).not.toContain('READING');
		expect(text).not.toContain('PREV');
		expect(text).not.toContain('UPLOAD A FILE');
	});

	test('the empty-state copy is author-cased too', () => {
		const { container } = renderPage({ total: 0 });
		const text = container.textContent ?? '';
		expect(text).toContain('Nothing on file');
		expect(text).not.toContain('NOTHING ON FILE');
	});

	// EPUB/PDF/CBZ/CBR are initialisms — caps IS their real casing, and the one
	// place the convention does not apply.
	test('format initialisms keep their real casing', () => {
		const { container } = renderPage({ books: [book()], total: 1 });
		expect(container.querySelector('.kicker')?.textContent).toContain('EPUB');
	});
});

// Negative: a presence-only suite stays green through a shadcn relapse.
describe('/libraries/[id] — no off-system chrome', () => {
	test('renders no shadcn, colored-pill or format-color classes', () => {
		const states: Record<string, unknown>[] = [
			{ books: [book(), book({ id: 'b2', format: 'pdf' })], total: 2, user: admin },
			{ total: 0, user: admin },
			{ total: 0, filters: { q: 'x', sort: 'title', order: 'asc', page: 1 } }
		];

		for (const state of states) {
			const { container } = renderPage(state);
			const offSystem = [...container.querySelectorAll('*')].filter((el) =>
				/rounded-|shadow-|bg-muted|destructive|bg-emerald|bg-blue-|bg-red-|bg-purple-|bg-orange-|bg-yellow-/.test(
					el.getAttribute('class') ?? ''
				)
			);
			expect(offSystem).toHaveLength(0);
		}
	});
});

// The jsdom substitute for the missing visual-verification harness: the only thing
// in the repo that goes red when someone reintroduces a shadow, a rounded corner,
// an off-palette colour, a shadcn import or a broken column fold on this screen.
describe('/libraries/[id] source guard', () => {
	// Comments are stripped first — the prose names the forbidden colors and would
	// false-red the scans on its own rationale.
	// The line-comment strip is anchored to the start of a line: an unanchored
	// /\/\/[^\n]*/g also eats the tail of any line holding a `//` in real content
	// (an href="https://…", a url(//cdn…)), which would silently blank that line
	// for every scan below and make the whole guard pass vacuously.
	const src = readFileSync(pageSource, 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */
		.replace(/<!--[\s\S]*?-->/g, ' ') // <!-- html -->
		.replace(/^\s*\/\/[^\n]*/gm, ' '); // // line

	test('no hex literals', () => {
		expect(src.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
	});

	// Gradients are in here because a linear-gradient() built entirely from allowed
	// var() tokens passes the hex, named-color and allowlist scans untouched.
	test('no color functions and no gradients', () => {
		expect(
			src.match(
				/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|(linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient)\s*\(/gi
			)
		).toBeNull();
	});

	// The (?<![\w-]) / (?![\w-]) fences keep --wired-black from tripping "black".
	test('no chromatic named colors', () => {
		expect(
			src.match(
				/(?<![\w-])(red|green|blue|orange|yellow|purple|pink|gray|grey|black|white|cyan|magenta|teal|navy|olive|maroon|silver|gold|crimson|hotpink)(?![\w-])/gi
			)
		).toBeNull();
	});

	// Derived from tokens.css rather than hand-copied: a hardcoded subset false-reds
	// the legitimate --space-1/4/12/40/48 the design system already defines, and a
	// false red is what gets a guard deleted rather than fixed.
	test('every var(--…) names a token defined in tokens.css', () => {
		const tokensCss = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), '../../../../lib/tokens.css'),
			'utf8'
		);
		const defined = [...tokensCss.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]);
		expect(defined.length).toBeGreaterThan(0);

		const used = [...src.matchAll(/var\(\s*(--[\w-]+)/gi)].map((m) => m[1]);
		// Guard the guard: an off-palette rewrite that empties the scan must fail,
		// not pass vacuously.
		expect(used.length).toBeGreaterThan(0);
		for (const t of used) expect(defined).toContain(t);
	});

	// text-shadow / drop-shadow() / transition-property are the synonyms a naive
	// three-regex version misses — each re-admits exactly what DESIGN.md §6/§7
	// forbids. The radius scan stops at ; or } so a final declaration with no
	// trailing semicolon can't slip past.
	test('flat by religion: no shadow, no radius other than 0, no transition: all', () => {
		expect(src.match(/box-shadow|text-shadow|drop-shadow\s*\(/gi)).toBeNull();
		const radii = [...src.matchAll(/border-radius\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim());
		expect(radii.length).toBeGreaterThan(0);
		for (const r of radii) expect(r).toBe('0');
		expect(src.match(/transition(-property)?\s*:\s*all/gi)).toBeNull();
	});

	// B.0 progress guard: this route dropped its shadcn imports and must not grow
	// them back (5 importer files → 4).
	test('imports nothing from $lib/components/ui', () => {
		expect(src.match(/\$lib\/components\/ui/g)).toBeNull();
	});

	test('carries no dark: variant and no off-system utility classes', () => {
		expect(src.match(/\bdark:/g)).toBeNull();
		expect(src.match(/rounded-|shadow-|bg-muted|destructive/g)).toBeNull();
		expect(src.match(/FORMAT_COLORS/g)).toBeNull();
	});

	// The lift, the highlight and the hand-rolled escaper all left with the card
	// grid. The {@html} removal also retired an XSS surface being defended by hand.
	test('no gsap lift, no {@html} and no <mark> highlighting', () => {
		expect(src.match(/gsap/gi)).toBeNull();
		expect(src.match(/\{@html/g)).toBeNull();
		expect(src.match(/<mark/g)).toBeNull();
		expect(src.match(/escapeHTML/g)).toBeNull();
	});

	// Presence is NOT the property that matters here, and pinning it is what let the
	// original bug ship: a media query adds no specificity, so `.tile:nth-child(4n+1)`
	// declared outside one (0,2,0) outranks any `.tile` reset a narrower block can
	// write (0,1,0), and `4n + 1` still MATCHES at three columns. The re-declarations
	// were all present and none of them applied — folds sat mid-row at 1024–1279px
	// and gutters collapsed at 768–1023px, with every string-presence guard green.
	//
	// So assert the STRUCTURE that makes the cascade work: every modulus bounded to
	// its own breakpoint, and none of them at the top level.
	const mediaBlocks = () =>
		[...src.matchAll(/@media ([^{]+)\{([\s\S]*?)\n\t\}/g)].map((m) => ({
			query: m[1].trim(),
			body: m[2]
		}));

	test('every column-fold modulus is bounded to its own breakpoint', () => {
		const owner = (modulus: string) =>
			mediaBlocks().find((b) => b.body.includes(`nth-child(${modulus}`))?.query;

		// 4n must not reach the 3- or 2-column bands.
		expect(owner('4n + 1')).toMatch(/min-width:\s*1280px/);

		// 3n must be fenced on BOTH sides — a bare max-width leaks onto two columns,
		// where it strips the wrong tiles' gutters.
		expect(owner('3n + 1')).toMatch(/min-width:\s*1024px/);
		expect(owner('3n + 1')).toMatch(/max-width:\s*1279px/);

		expect(owner('2n + 1')).toMatch(/max-width:\s*1023px/);

		// Nothing may declare a modulus outside a media block at all.
		const topLevel = src.replace(/@media [^{]+\{[\s\S]*?\n\t\}/g, '');
		expect(topLevel).not.toMatch(/nth-child\(\d+n/);
	});

	test('the fold is painted once and turns off below the two-column breakpoint', () => {
		expect(src).toMatch(/\.tile::before\s*\{[^}]*background:\s*var\(--wired-black\)/);

		const twoCol = mediaBlocks().find((b) => /max-width:\s*1023px/.test(b.query))?.body;
		expect(twoCol).toMatch(/\.tile::before\s*\{[^}]*display:\s*none/);
	});

	// Scoped to the pagination markup on purpose: an unscoped ellipsis scan would
	// false-red on the search placeholder, and a false red gets a guard deleted.
	test('pagination is Prev / indicator / Next — no numbered links, no ellipsis', () => {
		expect(src.match(/paginationPages/g)).toBeNull();

		const nav = src.match(/<nav class="pagination"[\s\S]*?<\/nav>/)?.[0];
		expect(nav).toBeTruthy();
		expect(nav).not.toContain('…');
		expect(nav).not.toContain('...');
		expect(nav).not.toContain('{#each');
	});

	test('localStorage is used only for the sort key, and written exactly once', () => {
		expect(src).toContain('library-grid-sort');
		expect(src.match(/localStorage\.setItem/g)).toHaveLength(1);
		expect(src.match(/localStorage\.getItem/g)).toHaveLength(1);
	});

	// The email must outrank UtilityBar's `.utility-right > :global(*)`, which ties
	// on specificity — a bare `.session-email` would be decided by stylesheet order.
	test('the email opt-out is qualified enough to win', () => {
		expect(src).toMatch(/span\.session-email\s*\{[^}]*text-transform:\s*none/);
		expect(src).toMatch(/span\.session-email\s*\{[^}]*display:\s*none/);
		expect(src.match(/[^n]\.session-email\s*\{/g)).toBeNull();
	});

	// 100vh must be declared BEFORE 100dvh: on mobile Safari/Chrome 100vh is the
	// large viewport, so the fallback has to come first or the footer sits below
	// the fold on first paint.
	test('declares the 100vh fallback before 100dvh', () => {
		const vh = src.indexOf('min-height: 100vh');
		const dvh = src.indexOf('min-height: 100dvh');
		expect(vh).toBeGreaterThan(-1);
		expect(dvh).toBeGreaterThan(vh);
	});

	// Without bottom padding the pagination butts onto the dark footer.
	test('the column reserves space below the pagination at every width', () => {
		expect(src).toMatch(
			/\.column\s*\{[^}]*padding:\s*var\(--space-48\)\s+var\(--space-24\)\s+var\(--space-48\)/
		);

		// AC16 narrows the SIDES on mobile. A third value here shrinks the bottom too,
		// which is how the 48px quietly became 32px.
		const mobile = mediaBlocks().find((b) => /max-width:\s*767px/.test(b.query))?.body;
		expect(mobile).toMatch(/\.column\s*\{[^}]*padding:\s*var\(--space-48\)\s+var\(--space-16\);/);
	});

	// DESIGN.md §8 locks mono at 13px. The ramp must never scale a kicker.
	test('the responsive ramp never rescales the mono kickers', () => {
		expect(src.match(/\.mono-kicker/g)).toBeNull();
	});

	// sortExplicit and activeFormat come from the LOAD precisely so no third $app/*
	// module enters the graph — that third module is the trip-wire that promotes the
	// deferred sveltekit()-plugin swap in vitest.config.ts.
	test('imports only the two $app modules the test config aliases', () => {
		const modules = [...src.matchAll(/from '(\$app\/[\w-]+)'/g)].map((m) => m[1]);
		expect([...new Set(modules)].sort()).toEqual(['$app/forms', '$app/navigation']);
	});
});

// The load is where AC4 lives, and it had no test at all — while Dev Notes gotcha
// #7 names the format alias as the seam that renders an empty grid if half of it
// ships. Mocked at the api boundary so nothing hits the network.
vi.mock('$lib/server/api', () => ({
	getLibrary: vi.fn(),
	listLibraryBooks: vi.fn(),
	getLibraryFilters: vi.fn()
}));

describe('/libraries/[id] — load contract', () => {
	beforeEach(() => {
		// Calls, not implementations: without this every sentParams() below reads the
		// FIRST test's request and the whole describe asserts one stale call.
		vi.clearAllMocks();
		vi.mocked(getLibrary).mockResolvedValue({ id: 'lib-1', name: 'Fiction' } as never);
		vi.mocked(getLibraryFilters).mockResolvedValue({} as never);
		vi.mocked(listLibraryBooks).mockResolvedValue({
			books: [],
			total: 0,
			limit: 24,
			offset: 0
		} as never);
	});

	function callLoad(search = '') {
		return (load as never as (e: unknown) => Promise<Record<string, unknown>>)({
			request: new Request('http://localhost/'),
			params: { id: 'lib-1' },
			parent: async () => ({ user: reader }),
			url: new URL(`http://localhost/libraries/lib-1${search}`)
		});
	}

	const sentParams = () => {
		const calls = vi.mocked(listLibraryBooks).mock.calls;
		expect(calls.length).toBeGreaterThan(0);
		return calls.at(-1)![2] as unknown as URLSearchParams;
	};

	// Both halves of the alias, in one assertion each: the segment that lights AND
	// the formats actually requested. Shipping one without the other is the empty-grid
	// failure Dev Notes gotcha #7 describes.
	test.each([
		['?format=comic', 'comic', 'cbz,cbr,images'],
		['?format=cbz', 'comic', 'cbz,cbr,images'],
		['?format=images', 'comic', 'cbz,cbr,images'],
		['?format=epub', 'epub', 'epub'],
		['?format=pdf', 'pdf', 'pdf']
	])('%s lights %s and requests %s', async (search, activeFormat, sent) => {
		const data = await callLoad(search);
		expect(data.activeFormat).toBe(activeFormat);
		expect(sentParams().get('format')).toBe(sent);
	});

	// A narrow comic value lights the COMIC segment, so it must FETCH the comic set —
	// otherwise the lit segment claims formats it excluded, and FilterStrip ignores a
	// re-click on the active segment, leaving no way to widen.
	test('a narrow comic format is widened to the whole comic set', async () => {
		await callLoad('?format=cbr');
		expect(sentParams().get('format')).toBe('cbz,cbr,images');
	});

	test.each(['?format=', '?format=,', '?format=%20', '?format=nonsense'])(
		'%s is dropped rather than forwarded as an active filter',
		async (search) => {
			const data = await callLoad(search);
			expect(data.activeFormat).toBe('');
			expect(sentParams().has('format')).toBe(false);
			expect((data.filters as { format?: string }).format).toBeUndefined();
		}
	);

	// parseInt('') and parseInt('abc') are both NaN, and NaN survives Math.max —
	// which painted `Showing NaN–NaN of 127` with both pager controls live.
	test.each(['?page=abc', '?page=', '?page=0', '?page=-3', '?page=1.5'])(
		'%s falls back to a usable page number',
		async (search) => {
			const data = await callLoad(search);
			const page = (data.filters as { page: number }).page;
			expect(Number.isInteger(page)).toBe(true);
			expect(page).toBeGreaterThanOrEqual(1);
			expect(sentParams().get('offset')).toBe(String((page - 1) * 24));
		}
	);

	test('a page past the last one redirects to the last real page', async () => {
		vi.mocked(listLibraryBooks).mockResolvedValue({
			books: [],
			total: 127,
			limit: 24,
			offset: 0
		} as never);

		await expect(callLoad('?page=9999')).rejects.toMatchObject({
			status: 302,
			location: '/libraries/lib-1?page=6'
		});
	});

	test('an in-range page does not redirect', async () => {
		vi.mocked(listLibraryBooks).mockResolvedValue({
			books: [],
			total: 127,
			limit: 24,
			offset: 0
		} as never);

		const data = await callLoad('?page=6');
		expect((data.filters as { page: number }).page).toBe(6);
	});

	test('sortExplicit tracks either sort param, not both', async () => {
		expect((await callLoad('')).sortExplicit).toBe(false);
		expect((await callLoad('?sort=author')).sortExplicit).toBe(true);
		// Title Z–A emits order alone, since buildUrl omits the default sort.
		expect((await callLoad('?order=desc')).sortExplicit).toBe(true);
	});

	test('the dropped view param is neither returned nor forwarded', async () => {
		const data = await callLoad('?view=list');
		expect(data).not.toHaveProperty('view');
		expect(data.filters).not.toHaveProperty('view');
		expect(sentParams().has('view')).toBe(false);
	});

	// No UI sets these, but a hand-typed or bookmarked filter must still reach the API
	// — re-adding the controls later is then a pure UI story.
	test('UI-less filters survive into the API request', async () => {
		await callLoad('?author=Ted+Chiang&series=Exhalation&language=en&tags=scifi,short');
		expect(sentParams().get('author')).toBe('Ted Chiang');
		expect(sentParams().get('series')).toBe('Exhalation');
		expect(sentParams().get('language')).toBe('en');
		expect(sentParams().get('tags')).toBe('scifi,short');
	});

	test('server defaults are never sent as explicit params', async () => {
		await callLoad('?sort=title&order=asc');
		expect(sentParams().has('sort')).toBe(false);
		expect(sentParams().has('order')).toBe(false);
	});
});
