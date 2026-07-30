import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Breadcrumb from '../Breadcrumb.svelte';

// Resolved in two steps on purpose: a literal `new URL('../Breadcrumb.svelte',
// import.meta.url)` is Vite's asset-URL pattern and gets rewritten to an
// http://localhost asset path, which fileURLToPath then rejects. Converting
// import.meta.url first keeps this a plain filesystem read.
const componentSource = join(dirname(fileURLToPath(import.meta.url)), '../Breadcrumb.svelte');

// jsdom does no layout and does not compute scoped <style>, so the mono/caps type,
// the Caption-Gray→Ink→Link-Blue palette, the 150ms hover and the 2px focus outline
// are visual-check items — never asserted here (getComputedStyle returns empty →
// false greens/reds). What IS testable: element structure, the class/aria hooks,
// href presence, and — for the palette AC — the component source itself. No harness:
// trail is a plain array, so render(Breadcrumb, { trail }) works directly.
describe('Breadcrumb', () => {
	const trail = [
		{ label: 'LIBRARIES', href: '/' },
		{ label: 'THE GARAGE SHELF', href: '/libraries/1' },
		{ label: 'EXHALATION' }
	];

	test('root is a <nav aria-label="Breadcrumb">', () => {
		const { container } = render(Breadcrumb, { trail });
		const nav = container.querySelector('nav');
		expect(nav).not.toBeNull();
		expect(nav?.getAttribute('aria-label')).toBe('Breadcrumb');
		expect(nav?.classList.contains('breadcrumb')).toBe(true);
	});

	test('one <li> per trail entry, labels in DOM order', () => {
		const { container } = render(Breadcrumb, { trail });
		const items = [...container.querySelectorAll('li')];
		expect(items).toHaveLength(3);
		// Strip the leading separator glyph so only the crumb label remains.
		const labels = items.map((li) => li.textContent?.replace('›', '').trim());
		expect(labels).toEqual(['LIBRARIES', 'THE GARAGE SHELF', 'EXHALATION']);
	});

	test('the last entry is the current page: .current/aria-current="page", not an <a>', () => {
		const { container } = render(Breadcrumb, { trail });
		const current = container.querySelector('.current');
		expect(current?.tagName).toBe('SPAN');
		expect(current?.getAttribute('aria-current')).toBe('page');
		expect(current?.textContent).toBe('EXHALATION');
		// The last <li> must not contain an anchor.
		const lastLi = container.querySelectorAll('li')[2];
		expect(lastLi.querySelector('a')).toBeNull();
	});

	// isLast beats href: even when the last entry carries an href it renders as the
	// current non-link <span> — this bites the "check isLast before href" ordering.
	test('the last entry stays the current <span> even when it carries an href', () => {
		const withHref = [
			{ label: 'LIBRARIES', href: '/' },
			{ label: 'SETTINGS', href: '/settings' }
		];
		const { container } = render(Breadcrumb, { trail: withHref });
		const lastLi = container.querySelectorAll('li')[1];
		const current = lastLi.querySelector('.current');
		expect(current?.tagName).toBe('SPAN');
		expect(current?.getAttribute('aria-current')).toBe('page');
		expect(current?.textContent).toBe('SETTINGS');
		expect(lastLi.querySelector('a')).toBeNull();
	});

	test('an earlier entry with an href renders as <a class="crumb" href>', () => {
		const { container } = render(Breadcrumb, { trail });
		const anchors = [...container.querySelectorAll('a.crumb')];
		expect(anchors).toHaveLength(2);
		expect(anchors[0].getAttribute('href')).toBe('/');
		expect(anchors[0].textContent).toBe('LIBRARIES');
		expect(anchors[1].getAttribute('href')).toBe('/libraries/1');
		expect(anchors[1].textContent).toBe('THE GARAGE SHELF');
	});

	// The non-navigable ancestor case: an earlier entry without an href is a plain
	// <span class="crumb">, never an <a>.
	test('an earlier entry without an href renders as <span class="crumb">, not an <a>', () => {
		const noHref = [
			{ label: 'LIBRARIES' },
			{ label: 'THE GARAGE SHELF', href: '/libraries/1' },
			{ label: 'EXHALATION' }
		];
		const { container } = render(Breadcrumb, { trail: noHref });
		const firstLi = container.querySelectorAll('li')[0];
		const span = firstLi.querySelector('span.crumb');
		expect(span?.tagName).toBe('SPAN');
		expect(span?.textContent).toBe('LIBRARIES');
		expect(firstLi.querySelector('a')).toBeNull();
	});

	test('exactly trail.length - 1 separators, each "›" and aria-hidden', () => {
		const { container } = render(Breadcrumb, { trail });
		const seps = [...container.querySelectorAll('.sep')];
		expect(seps).toHaveLength(trail.length - 1);
		for (const sep of seps) {
			expect(sep.textContent).toBe('›');
			expect(sep.getAttribute('aria-hidden')).toBe('true');
		}
	});

	test('single-entry trail: the sole entry is current, with no separator and no link', () => {
		const { container } = render(Breadcrumb, { trail: [{ label: 'SETTINGS' }] });
		expect(container.querySelectorAll('li')).toHaveLength(1);
		const current = container.querySelector('.current');
		expect(current?.getAttribute('aria-current')).toBe('page');
		expect(current?.textContent).toBe('SETTINGS');
		expect(container.querySelector('.sep')).toBeNull();
		expect(container.querySelector('a')).toBeNull();
	});

	test('a caller class merges with the base class instead of clobbering it', () => {
		const { container } = render(Breadcrumb, { trail, class: 'mt-4' });
		const nav = container.querySelector('nav');
		expect(nav?.classList.contains('breadcrumb')).toBe(true);
		expect(nav?.classList.contains('mt-4')).toBe(true);
	});

	test('rest props pass through to the root <nav>', () => {
		const { container } = render(Breadcrumb, { trail, 'data-testid': 'bc' });
		expect(container.querySelector('nav')?.getAttribute('data-testid')).toBe('bc');
	});

	// A test that goes red if someone types a greater-than (U+003E) or a » (U+00BB)
	// instead of the pinned U+203A single right-pointing angle quotation mark.
	test('the separator glyph is U+203A, not ">"', () => {
		const { container } = render(Breadcrumb, { trail });
		const sep = container.querySelector('.sep');
		expect(sep?.textContent).toBe('›');
		expect(sep?.textContent).not.toBe('>');
	});

	// The epic AC says "component tests assert no off-palette color". jsdom cannot
	// compute the scoped <style>, so the guard reads the source instead: deterministic,
	// fast, and red the instant someone reaches for a hex, an rgba(…), a named color,
	// or a token outside the five Breadcrumb legitimately uses.
	test('never introduces a color outside the palette', () => {
		const raw = readFileSync(componentSource, 'utf8');
		// Strip comments FIRST — the prose explains the palette ("Caption Gray",
		// "recolors on hover"), so the checks must see only real code or they'd
		// false-red on their own rationale.
		const src = raw
			.replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */
			.replace(/<!--[\s\S]*?-->/g, ' ') // <!-- html -->
			.replace(/\/\/[^\n]*/g, ' '); // // line

		// (1) No hex literals.
		expect(src.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();

		// (2) No color functions. rgb/hsl/etc. carry no `#` and no `var(`, so the hex
		// and token checks alone would wave them through.
		expect(src.match(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/gi)).toBeNull();

		// (3) No chromatic named colors. The (?<![\w-]) / (?![\w-]) fences keep
		// `--wired-black` from tripping "black". Colorless keywords are absent by design.
		expect(
			src.match(
				/(?<![\w-])(red|green|blue|orange|yellow|purple|pink|gray|grey|black|white|cyan|magenta|teal|navy|olive|maroon|silver|gold|crimson|hotpink)(?![\w-])/gi
			)
		).toBeNull();

		// (4) Every var(--…) must name an allowed token. Keep the guard-the-guard:
		// Breadcrumb owns color, so an all-off-palette rewrite that empties the scan
		// must fail, not pass vacuously (the StatusTag shape, not the widened B.10 one).
		const tokens = [...src.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]);
		expect(tokens.length).toBeGreaterThan(0);
		const allowed = ['--caption-gray', '--page-ink', '--link-blue', '--wired-black', '--font-mono'];
		for (const t of tokens) expect(allowed).toContain(t);
	});
});
