import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import RoundIconButton from '../RoundIconButton.svelte';

// Resolved in two steps on purpose: a literal `new URL('../RoundIconButton.svelte',
// import.meta.url)` is Vite's asset-URL pattern and gets rewritten to an
// http://localhost asset path, which fileURLToPath then rejects. Converting
// import.meta.url first keeps this a plain filesystem read.
const componentSource = join(dirname(fileURLToPath(import.meta.url)), '../RoundIconButton.svelte');

// jsdom does no layout and does not compute scoped <style>, so the 40px circle, the
// border-radius:50%, the 1px-vs-2px border, the Page-Ink→Link-Blue hover recolor, the
// 16px svg and the 2px focus outline are visual-check items — never asserted here
// (getComputedStyle returns empty → false greens/reds). What IS testable: element
// structure, the type/aria/.active/class hooks, which glyph rendered, the two dev-guard
// throws, and — for the palette AC — the component source itself. No harness: every
// prop is a serializable primitive, so render(RoundIconButton, { icon, 'aria-label' })
// works directly.
describe('RoundIconButton', () => {
	test('root is a <button type="button" class="round-icon-btn">', () => {
		const { container } = render(RoundIconButton, { icon: 'search', 'aria-label': 'Search' });
		const btn = container.querySelector('button.round-icon-btn');
		expect(btn).not.toBeNull();
		expect(btn?.tagName).toBe('BUTTON');
		expect(btn?.getAttribute('type')).toBe('button');
	});

	test('aria-label is applied to the button', () => {
		const { container } = render(RoundIconButton, { icon: 'search', 'aria-label': 'Search' });
		expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Search');
	});

	test('icon="search" renders the search glyph: a <line>, no <path>', () => {
		const { container } = render(RoundIconButton, { icon: 'search', 'aria-label': 'Search' });
		expect(container.querySelector('svg line')).not.toBeNull();
		expect(container.querySelector('svg path')).toBeNull();
	});

	test('icon="account" renders the account glyph: circle cy="9" + path, no <line>', () => {
		const { container } = render(RoundIconButton, { icon: 'account', 'aria-label': 'Account' });
		// cy="9" discriminates the account head from the gear hub (cy="12").
		expect(container.querySelector('svg circle')?.getAttribute('cy')).toBe('9');
		expect(container.querySelector('svg path')).not.toBeNull();
		expect(container.querySelector('svg line')).toBeNull();
	});

	test('icon="settings" renders the gear glyph: circle r="3" + path, no <line>', () => {
		const { container } = render(RoundIconButton, { icon: 'settings', 'aria-label': 'Settings' });
		// r="3" discriminates the gear hub from the account head (r="4").
		expect(container.querySelector('svg circle')?.getAttribute('r')).toBe('3');
		expect(container.querySelector('svg path')).not.toBeNull();
		expect(container.querySelector('svg line')).toBeNull();
	});

	test('exactly one <svg> renders (the {#if} is exclusive)', () => {
		const { container } = render(RoundIconButton, { icon: 'account', 'aria-label': 'Account' });
		expect(container.querySelectorAll('svg')).toHaveLength(1);
	});

	test('the <svg> is decorative: aria-hidden="true" and focusable="false"', () => {
		const { container } = render(RoundIconButton, { icon: 'search', 'aria-label': 'Search' });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
		expect(svg?.getAttribute('focusable')).toBe('false');
	});

	test('active toggles the .active class', () => {
		const { container } = render(RoundIconButton, {
			icon: 'account',
			'aria-label': 'Account',
			active: true
		});
		expect(container.querySelector('button')?.classList.contains('active')).toBe(true);
	});

	// Assert the negative so a default-leak refactor can't pass silently (B.5/B.6/B.8).
	test('active defaults to false: no .active class when unset', () => {
		const { container } = render(RoundIconButton, { icon: 'account', 'aria-label': 'Account' });
		expect(container.querySelector('button')?.classList.contains('active')).toBe(false);
	});

	// The dev-guard is live under vitest (import.meta.env.DEV is true). Wrap render in a
	// thunk — a bare render() that throws would fail the test file to load.
	test('a missing aria-label throws (dev-guard, AC5)', () => {
		// The missing required prop is the point of the test — the compile error it
		// would otherwise raise is the type-level half of the same guarantee.
		// @ts-expect-error aria-label is intentionally omitted to trip the dev-guard
		expect(() => render(RoundIconButton, { icon: 'search' })).toThrow();
	});

	test('an empty-string aria-label throws too (!ariaLabel catches "")', () => {
		expect(() => render(RoundIconButton, { icon: 'search', 'aria-label': '' })).toThrow();
	});

	// A whitespace-only label is empty to assistive tech — the .trim() in the guard
	// rejects it just like '' (a bare !ariaLabel would let it through).
	test('a whitespace-only aria-label throws too (!ariaLabel?.trim() catches "   ")', () => {
		expect(() => render(RoundIconButton, { icon: 'search', 'aria-label': '   ' })).toThrow();
	});

	test('a caller class merges with the base class instead of clobbering it', () => {
		const { container } = render(RoundIconButton, {
			icon: 'search',
			'aria-label': 'Search',
			class: 'ml-2'
		});
		const btn = container.querySelector('button');
		expect(btn?.classList.contains('round-icon-btn')).toBe(true);
		expect(btn?.classList.contains('ml-2')).toBe(true);
		expect(btn?.classList.contains('active')).toBe(false);
	});

	test('rest props pass through to the <button>', () => {
		const { container } = render(RoundIconButton, {
			icon: 'search',
			'aria-label': 'Search',
			'data-testid': 'ib',
			title: 'Search'
		});
		const btn = container.querySelector('button');
		expect(btn?.getAttribute('data-testid')).toBe('ib');
		expect(btn?.getAttribute('title')).toBe('Search');
	});

	// The epic AC says "component tests assert no off-palette color". jsdom cannot
	// compute the scoped <style>, so the guard reads the source instead: deterministic,
	// fast, and red the instant someone reaches for a hex, an rgba(…), a named color, or
	// a token outside the four RoundIconButton legitimately uses. The inline SVG attrs
	// (fill="none", stroke="currentColor", stroke-linecap="square", numeric coordinates)
	// carry no #, no color-function, and no chromatic word, so they survive the checks.
	test('never introduces a color outside the palette', () => {
		const raw = readFileSync(componentSource, 'utf8');
		// Strip comments FIRST — the prose names colors ("Link Blue", "ink ring"), so
		// the checks must see only real code or they'd false-red on their own rationale.
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
		// `--wired-black`/`--link-blue`/`--caption-gray` from tripping "black"/"blue"/"gray".
		// Colorless keywords (none/currentColor/transparent/square) are absent by design.
		expect(
			src.match(
				/(?<![\w-])(red|green|blue|orange|yellow|purple|pink|gray|grey|black|white|cyan|magenta|teal|navy|olive|maroon|silver|gold|crimson|hotpink)(?![\w-])/gi
			)
		).toBeNull();

		// (4) Every var(--…) must name an allowed token. Keep the guard-the-guard:
		// RoundIconButton owns color, so an all-off-palette rewrite that empties the scan
		// must fail, not pass vacuously (the StatusTag/Breadcrumb shape, not the widened
		// B.10 one). Tightest allowlist in the set — four colors, no --font-mono (no text).
		const tokens = [...src.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]);
		expect(tokens.length).toBeGreaterThan(0);
		const allowed = ['--caption-gray', '--page-ink', '--link-blue', '--wired-black'];
		for (const t of tokens) expect(allowed).toContain(t);
	});
});
