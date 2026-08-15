import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PickerPage from '../+page.svelte';
import type { LibraryListEntry } from '$lib/server/api';

// Resolved in two steps on purpose: a literal `new URL('../+page.svelte',
// import.meta.url)` is Vite's asset-URL pattern and gets rewritten to an
// http://localhost asset path, which fileURLToPath then rejects.
const pageSource = join(dirname(fileURLToPath(import.meta.url)), '../+page.svelte');

// This file lives in __tests__/ rather than beside the route as +page.test.ts:
// that filename is picked up by svelte-kit sync as a route file and breaks it
// (Epic 01 A.4 lost a test to it). A subdirectory holding no +page.* declares
// no route.
//
// jsdom does no layout and does not compute Svelte scoped <style>, so the 3-column
// grid, the 64px numerals, the shared hairlines, the hover/focus rule swap and the
// under-word rule are all visual-check items — asserting them here would pass
// vacuously (getComputedStyle returns empty). What IS testable: structure, the
// link targets, the derived copy, and — for the palette/no-chrome ACs — the route
// source itself (second describe).

// Aliased to the real payload type rather than re-declared: a hand-written parallel
// shape stays green when the API stops sending a field, which is the one regression
// a fixture type exists to catch.
type TestLibrary = LibraryListEntry;

function library(overrides: Partial<TestLibrary> = {}): TestLibrary {
	return {
		id: 'lib-fiction',
		name: 'Fiction',
		description: 'Sci-fi, philosophy, and the occasional manual.',
		created_at: '2026-01-04 09:00:00',
		book_count: 127,
		user_count: 2,
		last_import_at: '2026-08-14 10:00:00',
		...overrides
	};
}

const reader = { id: 'u1', email: 'luigi@pharosgraph.com', is_admin: false, created_at: '' };
const admin = { ...reader, id: 'u2', email: 'admin@localhost.local', is_admin: true };

function renderPage(libraries: TestLibrary[], user: typeof reader = reader) {
	return render(PickerPage, { data: { libraries, user } as never });
}

describe('/ library picker — populated', () => {
	const two = [
		library(),
		library({ id: 'lib-comics', name: 'Comics', description: 'Graphic novels and issues.' })
	];

	test('renders one row per library, each a single link to the library', () => {
		const { container } = renderPage(two);

		const items = container.querySelectorAll('.rows li');
		expect(items).toHaveLength(2);

		const hrefs = [...container.querySelectorAll('.rows li a.row')].map((a) =>
			a.getAttribute('href')
		);
		expect(hrefs).toEqual(['/libraries/lib-fiction', '/libraries/lib-comics']);
	});

	// The numeral is the 1-based position in the rendered list, zero-padded —
	// never a database field.
	test('numbers the rows by rendered position, zero-padded', () => {
		const { container } = renderPage(two);
		const nums = [...container.querySelectorAll('.num')].map((n) => n.textContent);
		expect(nums).toEqual(['01', '02']);
	});

	test('the page kicker counts the collections', () => {
		const { container } = renderPage(two);
		expect(container.querySelector('.page-head .mono-kicker')?.textContent).toBe(
			'Issue · 02 Collections'
		);
	});

	// 'Fiction' derives from its description; 'Comics' is one of the four names the
	// design prompt specifies an editorial tag for, so the override answers instead.
	test('renders a vibe-tag kicker for every row, derived or specified', () => {
		const { container } = renderPage(two);
		const kickers = [...container.querySelectorAll('.mid .mono-kicker')].map((k) => k.textContent);
		expect(kickers).toEqual(['Sci-fi · philosophy · occasional', 'Graphic novels · Series']);
	});

	test('renders the library name and description', () => {
		const { container } = renderPage([library()]);
		expect(container.querySelector('.name')?.textContent).toBe('Fiction');
		expect(container.querySelector('.desc')?.textContent).toBe(
			'Sci-fi, philosophy, and the occasional manual.'
		);
	});

	// Explicit in the prompt: no em-dash placeholder, the node is simply absent.
	test('a library with no description renders no deck node at all', () => {
		const { container } = renderPage([library({ description: undefined })]);
		expect(container.querySelector('.desc')).toBeNull();
	});

	test('book counts are unpadded and pluralize', () => {
		const one = renderPage([library({ book_count: 1 })]);
		expect(one.container.querySelector('.meta .mono-kicker')?.textContent).toBe('1 Book');

		const two = renderPage([library({ book_count: 2 })]);
		expect(two.container.querySelector('.meta .mono-kicker')?.textContent).toBe('2 Books');
	});

	test('reader counts are zero-padded and pluralize', () => {
		const { container } = renderPage([library({ user_count: 1 })]);
		const lines = [...container.querySelectorAll('.meta .mono-kicker')].map((k) => k.textContent);
		expect(lines.at(-1)).toBe('01 Reader');
	});

	test('a library that has never been imported renders no last-import line', () => {
		const { container } = renderPage([library({ last_import_at: null })]);
		const lines = [...container.querySelectorAll('.meta .mono-kicker')].map((k) => k.textContent);
		expect(lines).toHaveLength(2);
		expect(container.querySelector('.meta')?.textContent).not.toContain('Last import');
	});

	test('a library with an import renders the last-import line', () => {
		const { container } = renderPage([library()]);
		const lines = [...container.querySelectorAll('.meta .mono-kicker')].map((k) => k.textContent);
		expect(lines).toHaveLength(3);
		expect(lines[1]).toContain('Last import · ');
	});

	// The deck names the newest import across everything; with nothing ever
	// imported the sentence is dropped rather than rendered with a placeholder.
	test('the deck drops the import sentence when no library has ever imported', () => {
		const { container } = renderPage([library({ last_import_at: null })]);
		expect(container.querySelector('.deck')?.textContent?.trim()).toBe(
			'Pick a collection to browse.'
		);
	});

	test('the deck names the most recent import when there is one', () => {
		const { container } = renderPage(two);
		const deck = container.querySelector('.deck')?.textContent ?? '';
		expect(deck).toContain('The most recent import across everything was');
	});

	test('the hero splits so the second word can carry its own rule', () => {
		const { container } = renderPage(two);
		const hero = container.querySelector('h1.hero');
		expect(hero?.textContent).toBe('Your libraries');
		expect(hero?.querySelector('.ul')?.textContent).toBe('libraries');
	});

	test('renders no empty state alongside the list', () => {
		const { container } = renderPage(two);
		expect(container.querySelector('.empty')).toBeNull();
	});

	// The anchor wraps the ordinal, the vibe tag, the description and three metadata
	// lines, so without an explicit name a screen reader reads the entire row —
	// decorative middots included — as the link's label.
	test('the row link is named for the library, not its whole contents', () => {
		const { container } = renderPage(two);
		const labels = [...container.querySelectorAll('.rows li a.row')].map((a) =>
			a.getAttribute('aria-label')
		);
		expect(labels).toEqual(['Fiction', 'Comics']);
	});

	test('the decorative ordinal is hidden from assistive tech', () => {
		const { container } = renderPage(two);
		expect(container.querySelector('.num')?.getAttribute('aria-hidden')).toBe('true');
	});

	// A whitespace-only description is not "no description": it passes the truthy
	// check and renders an empty node that still carries its 8px top margin.
	test('a whitespace-only description renders no deck node', () => {
		const { container } = renderPage([library({ description: '   ' })]);
		expect(container.querySelector('.desc')).toBeNull();
	});
});

describe('/ library picker — empty', () => {
	test('renders the empty block and a zeroed kicker', () => {
		const { container } = renderPage([]);

		expect(container.querySelector('.page-head .mono-kicker')?.textContent).toBe(
			'Issue · 00 Collections'
		);
		expect(container.querySelector('.deck')?.textContent?.trim()).toBe('No libraries yet.');

		const empty = container.querySelector('.empty');
		expect(empty?.querySelector('.mono-kicker')?.textContent).toBe('Nothing on file');
		expect(empty?.querySelector('.empty-headline')?.textContent).toBe(
			'This account has no library access.'
		);
		expect(empty?.querySelector('.empty-body')?.textContent?.trim()).toContain(
			'Accounts are invitation-only'
		);
	});

	// An admin reads the unfiltered list, so an empty one means no library exists —
	// not that this account was left out of one. The reader copy tells the
	// administrator to contact the administrator.
	test('tells an admin no library exists, not that they lack access', () => {
		const { container } = renderPage([], admin);
		const empty = container.querySelector('.empty');

		expect(empty?.querySelector('.empty-headline')?.textContent).toBe(
			'No libraries have been created yet.'
		);
		const body = empty?.querySelector('.empty-body')?.textContent ?? '';
		expect(body).toContain('Create the first collection');
		expect(body).not.toContain('invitation-only');
		expect(body).not.toContain('Contact the administrator');
	});

	test('the two empty-state arms do not leak into each other', () => {
		const asReader = renderPage([], reader);
		const readerBody = asReader.container.querySelector('.empty-body')?.textContent ?? '';
		expect(readerBody).toContain('invitation-only');
		expect(readerBody).not.toContain('Create the first collection');
		expect(asReader.container.querySelectorAll('.empty-headline')).toHaveLength(1);

		const asAdmin = renderPage([], admin);
		expect(asAdmin.container.querySelectorAll('.empty-headline')).toHaveLength(1);
	});

	test('renders no rows', () => {
		const { container } = renderPage([]);
		expect(container.querySelector('.rows')).toBeNull();
	});

	test('offers Create a library to an admin only', () => {
		const asAdmin = renderPage([], admin);
		const cta = asAdmin.container.querySelector('.empty-cta a');
		expect(cta?.getAttribute('href')).toBe('/admin/libraries');
		expect(cta?.textContent).toBe('Create a library');

		const asReader = renderPage([], reader);
		expect(asReader.container.querySelector('.empty-cta')).toBeNull();
	});

	// The hero keeps its identical 64px treatment in both states — "both panels
	// read as one system".
	test('keeps the hero and its under-word rule', () => {
		const { container } = renderPage([]);
		expect(container.querySelector('h1.hero .ul')?.textContent).toBe('libraries');
	});
});

describe('/ library picker — shell', () => {
	test('renders the breadcrumb segments in the utility bar', () => {
		const { container } = renderPage([library()]);
		const crumbs = [...container.querySelectorAll('.utility-left .crumb')].map(
			(c) => c.textContent
		);
		expect(crumbs).toEqual(['Cuatro Library', 'Libraries']);
	});

	test('shows the signed-in email as plain text, not a link', () => {
		const { container } = renderPage([library()]);
		const right = container.querySelector('.utility-right');
		expect(right?.querySelector('span')?.textContent).toBe('luigi@pharosgraph.com');
	});

	// The bar uppercases in CSS, so the email needs its own hook to opt out of the
	// shout and to drop off the strip at 375px. Asserting the DOM text alone cannot
	// see either — that is the layer the author-cased suite already covers.
	test('the email carries the hook that unshouts it and hides it on mobile', () => {
		const { container } = renderPage([library()]);
		const email = container.querySelector('.utility-right span.session-email');
		expect(email?.textContent).toBe('luigi@pharosgraph.com');
	});

	test('shows the Admin link only to an admin', () => {
		const asAdmin = renderPage([library()], admin);
		expect(
			asAdmin.container.querySelector('.utility-right a[href="/admin/libraries"]')?.textContent
		).toBe('Admin');

		const asReader = renderPage([library()], reader);
		expect(asReader.container.querySelector('.utility-right a[href="/admin/libraries"]')).toBeNull();
	});

	test('keeps the sign-out POST form the logout route reads', () => {
		const { container } = renderPage([library()]);
		const form = container.querySelector('form[action="/logout"]');
		expect(form?.getAttribute('method')?.toUpperCase()).toBe('POST');
		expect(form?.querySelector('button[type="submit"]')?.textContent).toBe('Sign out');
	});

	test('renders the two round nav icons with accessible names', () => {
		const { container } = renderPage([library()]);
		const labels = [...container.querySelectorAll('.round-icon-btn')].map((b) =>
			b.getAttribute('aria-label')
		);
		expect(labels).toEqual(['Search', 'Account']);
	});

	test('renders the footer, admin-aware', () => {
		const asReader = renderPage([library()], reader);
		expect(asReader.container.querySelector('.footer')).not.toBeNull();
		expect(asReader.container.querySelector('.footer a[href="/admin"]')).toBeNull();

		const asAdmin = renderPage([library()], admin);
		expect(asAdmin.container.querySelector('.footer a[href="/admin"]')).not.toBeNull();
	});
});

// Author-casing is the Epic 03 convention: MonoKicker, UtilityBar, Footer's links
// and Button all uppercase in CSS, so the rendered pixels are identical while the
// DOM text a screen reader announces keeps real casing. These assertions are what
// pin it — a .toUpperCase() creeping into the markup turns them red.
describe('/ library picker — author-cased copy', () => {
	test('never pre-shouts a string in the markup', () => {
		const { container } = renderPage([library({ book_count: 1, user_count: 1 })]);
		const text = container.textContent ?? '';

		expect(text).toContain('Issue · 01 Collection');
		expect(text).toContain('1 Book');
		expect(text).toContain('01 Reader');
		expect(text).toContain('Last import · ');

		expect(text).not.toContain('COLLECTIONS');
		expect(text).not.toContain('BOOKS');
		expect(text).not.toContain('READER');
		expect(text).not.toContain('LAST IMPORT');
	});

	test('the empty state copy is author-cased too', () => {
		const { container } = renderPage([], admin);
		const text = container.textContent ?? '';

		expect(text).toContain('Nothing on file');
		expect(text).toContain('Create a library');
		expect(text).not.toContain('NOTHING ON FILE');
		expect(text).not.toContain('CREATE A LIBRARY');
	});

	test('the breadcrumb is author-cased', () => {
		const { container } = renderPage([library()]);
		const text = container.querySelector('.utility-left')?.textContent ?? '';
		expect(text).toContain('Cuatro Library');
		expect(text).not.toContain('CUATRO LIBRARY');
	});
});

// Negative: a presence-only suite stays green through a shadcn relapse.
describe('/ library picker — no off-system chrome', () => {
	test('renders no shadcn/off-system chrome classes', () => {
		for (const libraries of [[library()], []]) {
			const { container } = renderPage(libraries, admin);
			const offSystem = [...container.querySelectorAll('*')].filter((el) =>
				/rounded-|shadow-|bg-muted|destructive/.test(el.getAttribute('class') ?? '')
			);
			expect(offSystem).toHaveLength(0);
		}
	});
});

// The jsdom substitute for the missing visual-verification harness: the only
// thing in the repo that goes red when someone reintroduces a shadow, a rounded
// corner, an off-palette colour, or a shadcn import on this screen.
describe('/ library picker source guard', () => {
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
			join(dirname(fileURLToPath(import.meta.url)), '../../lib/tokens.css'),
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
		for (const r of radii) expect(r).toBe('0');
		expect(src.match(/transition(-property)?\s*:\s*all/gi)).toBeNull();
	});

	// B.0 progress guard: this route dropped its shadcn import and must not grow
	// it back (6 importer files → 5).
	test('imports nothing from $lib/components/ui', () => {
		expect(src.match(/\$lib\/components\/ui/g)).toBeNull();
	});

	test('carries no dark: variant and no off-system utility classes', () => {
		expect(src.match(/\bdark:/g)).toBeNull();
		expect(src.match(/rounded-|shadow-|bg-muted|destructive/g)).toBeNull();
	});

	// The prototype's bug this markup exists to avoid: a top border only on
	// `li + li` means hovering row 01 adds 1px that nothing compensates for and
	// nudges the whole list down.
	test('every row carries a transparent top border, not just li + li', () => {
		expect(src).toMatch(/\.rows\s+li\s*\{[^}]*border-top:\s*1px\s+solid\s+transparent/);
	});

	// Focus parity is mandatory: a full-row link that only answers the mouse is a
	// keyboard trap in spirit, and the prompt specifies no focus state at all.
	// Counted rather than merely present: BOTH :has() rules (the row's own pair of
	// borders, and the following row's top border) need the keyboard arm. Asserting
	// a single occurrence stays green when one of the two is dropped, which leaves
	// the swap half mouse-only.
	test('the rule swap and the name underline both answer :focus-visible', () => {
		expect(src.match(/\.rows li:has\(\.row:focus-visible\)/g)).toHaveLength(2);
		expect(src.match(/\.rows li:has\(\.row:hover\)/g)).toHaveLength(2);
		expect(src).toMatch(/\.row:focus-visible\s+\.name/);
		expect(src).toMatch(/\.row:focus-visible\s*\{[^}]*outline:\s*2px\s+solid/);
	});

	// `border-bottom: 0` has no width for the hover swap to paint, so the last row
	// bracketed on one edge only. The resting hairline must be transparent instead.
	test('the last row keeps a paintable bottom border', () => {
		expect(src).toMatch(/\.rows li:last-child\s*\{[^}]*border-bottom-color:\s*transparent/);
		expect(src.match(/\.rows li:last-child\s*\{[^}]*border-bottom:\s*0/)).toBeNull();
	});

	// Row 01's top edge is already the 2px opening bracket; the hover hairline
	// stacking under it reads as one 3px rule.
	test('row 01 does not paint a hover rule under the opening bracket', () => {
		expect(src).toMatch(/\.rows li:first-child:has\(\.row:hover\)/);
		expect(src).toMatch(/\.rows li:first-child:has\(\.row:focus-visible\)/);
	});

	// Without bottom padding the closing bracket butts onto the dark footer and
	// stops reading as a rule.
	test('the column reserves space below the closing bracket', () => {
		expect(src).toMatch(/\.column\s*\{[^}]*padding:\s*var\(--space-64\)\s+var\(--space-24\)\s+var\(--space-48\)/);
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

	// DESIGN.md §8 locks mono at 13px. The ramp must never scale a kicker.
	test('the responsive ramp never rescales the mono kickers', () => {
		expect(src.match(/\.mono-kicker/g)).toBeNull();
	});
});
