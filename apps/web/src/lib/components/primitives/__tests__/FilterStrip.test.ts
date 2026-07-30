import { describe, test, expect, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import FilterStrip from '../FilterStrip.svelte';
import FilterStripHarness from './FilterStripHarness.svelte';

// Resolved in two steps on purpose: a literal `new URL('../FilterStrip.svelte',
// import.meta.url)` is Vite's asset-URL pattern and gets rewritten to an
// http://localhost asset path, which fileURLToPath then rejects. Converting
// import.meta.url first keeps this a plain filesystem read (the B.9 fix).
const componentSource = join(dirname(fileURLToPath(import.meta.url)), '../FilterStrip.svelte');

const OPTIONS = [
	{ value: 'all', label: 'ALL FORMATS' },
	{ value: 'epub', label: 'EPUB' },
	{ value: 'pdf', label: 'PDF' },
	{ value: 'comic', label: 'COMIC' }
];

// jsdom does no layout and computes neither FilterStrip's scoped <style> NOR the
// composed <Button>'s — so the 2px seam, the inversion, the sizing and the focus
// outline are visual-check items, never asserted here (getComputedStyle returns
// empty → false greens/reds). What IS testable, and unlike inert B.9 includes REAL
// click behavior: element structure, the primary/inverted class hooks, aria,
// onChange calls, and the component source (for the palette AC).
describe('FilterStrip', () => {
	test('renders one <button> per option, labels in render order', () => {
		const { container } = render(FilterStrip, { options: OPTIONS });
		const buttons = container.querySelectorAll('button');
		expect(buttons.length).toBe(OPTIONS.length);
		expect([...buttons].map((b) => b.textContent?.trim())).toEqual([
			'ALL FORMATS',
			'EPUB',
			'PDF',
			'COMIC'
		]);
	});

	test('initial active mapping: the value segment is inverted, the rest primary', () => {
		const { container } = render(FilterStrip, { options: OPTIONS, value: 'epub' });
		const buttons = container.querySelectorAll('button');
		// epub is index 1
		expect(buttons[1].classList.contains('inverted')).toBe(true);
		expect(buttons[1].classList.contains('primary')).toBe(false);
		// the negatives — every other segment is primary, none inverted
		for (const i of [0, 2, 3]) {
			expect(buttons[i].classList.contains('primary')).toBe(true);
			expect(buttons[i].classList.contains('inverted')).toBe(false);
		}
	});

	test('no value → nothing active: every segment is primary, none inverted', () => {
		const { container } = render(FilterStrip, { options: OPTIONS });
		const buttons = container.querySelectorAll('button');
		for (const b of buttons) {
			expect(b.classList.contains('primary')).toBe(true);
			expect(b.classList.contains('inverted')).toBe(false);
		}
	});

	test('click flips the active segment and fires onChange once with the value', () => {
		const onChange = vi.fn();
		const { container } = render(FilterStrip, { options: OPTIONS, value: 'all', onChange });
		const buttons = container.querySelectorAll('button');
		// flushSync so the reactive variant map re-renders synchronously after the
		// state write; native .click() fires <Button>'s onclick → select().
		flushSync(() => buttons[1].click()); // epub
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('epub');
		expect(buttons[1].classList.contains('inverted')).toBe(true);
		expect(buttons[0].classList.contains('primary')).toBe(true);
		expect(buttons[0].classList.contains('inverted')).toBe(false);
	});

	test('re-clicking the already-active segment is a no-op (no onChange)', () => {
		const onChange = vi.fn();
		const { container } = render(FilterStrip, { options: OPTIONS, value: 'all', onChange });
		const buttons = container.querySelectorAll('button');
		flushSync(() => buttons[0].click()); // all is already active
		expect(onChange).not.toHaveBeenCalled();
	});

	test('border-collapse structure proxy: one .seg-cell per option', () => {
		// The seam itself is a visual-check item — assert the STRUCTURE the collapse
		// rides on, never getComputedStyle the margin.
		const { container } = render(FilterStrip, { options: OPTIONS });
		expect(container.querySelectorAll('.seg-cell').length).toBe(OPTIONS.length);
	});

	test('the segment track is a role="group" carrying ariaLabel as aria-label', () => {
		const { container } = render(FilterStrip, { options: OPTIONS, ariaLabel: 'Format filter' });
		const seg = container.querySelector('.seg');
		expect(seg?.getAttribute('role')).toBe('group');
		expect(seg?.getAttribute('aria-label')).toBe('Format filter');
	});

	test('aria-pressed reflects the active segment', () => {
		const { container } = render(FilterStrip, { options: OPTIONS, value: 'pdf' });
		const buttons = container.querySelectorAll('button');
		expect(buttons[2].getAttribute('aria-pressed')).toBe('true'); // pdf
		for (const i of [0, 1, 3]) {
			expect(buttons[i].getAttribute('aria-pressed')).toBe('false');
		}
	});

	test('a caller class merges onto the root <div> instead of clobbering', () => {
		const { container } = render(FilterStrip, { options: OPTIONS, class: 'mt-6' });
		const root = container.querySelector('.filter-strip');
		expect(root?.classList.contains('mt-6')).toBe(true);
		expect(root?.classList.contains('filter-strip')).toBe(true);
	});

	test('rest props pass through to the root <div>', () => {
		const { container } = render(FilterStrip, { options: OPTIONS, 'data-testid': 'strip' });
		expect(container.querySelector('.filter-strip')?.getAttribute('data-testid')).toBe('strip');
	});

	// Reactivity guard: the variant is derived inline off `value` in the template. A
	// de-runing refactor (freezing value into a plain const) would still pass every
	// mount-time assertion above — only a rerender with a new value bites (B.9 precedent).
	test('the active segment reacts to a value update', async () => {
		const { container, rerender } = render(FilterStrip, { options: OPTIONS, value: 'all' });
		const buttons = container.querySelectorAll('button');
		expect(buttons[0].classList.contains('inverted')).toBe(true);
		await rerender({ options: OPTIONS, value: 'pdf' });
		expect(buttons[0].classList.contains('inverted')).toBe(false);
		expect(buttons[2].classList.contains('inverted')).toBe(true);
	});

	test('the trailing snippet renders inside .trailing when supplied', () => {
		const { container } = render(FilterStripHarness, { options: OPTIONS });
		const trailing = container.querySelector('.trailing');
		expect(trailing).not.toBeNull();
		expect(trailing?.querySelector('[data-testid="search-slot"]')).not.toBeNull();
	});

	test('no .trailing element exists when no trailing content is supplied', () => {
		const { container } = render(FilterStrip, { options: OPTIONS });
		expect(container.querySelector('.trailing')).toBeNull();
	});

	// The epic AC says component tests assert no off-palette color. jsdom cannot
	// compute the scoped <style> (nor the composed Button's), so the guard reads the
	// source. ADAPTED from B.9 (deferred-work.md 2026-07-21): the vacuous
	// `tokens.length > 0` "guard-the-guard" is DROPPED — FilterStrip legitimately
	// references no color token (all color is Button's), so requiring one would
	// false-red a correct implementation — and the allowlist is WIDENED to the full
	// palette + --font-*/--space-* passthrough.
	test('never introduces a color outside the palette', () => {
		const raw = readFileSync(componentSource, 'utf8');
		// Strip comments first — the prose names colors ("no color", "inversion") and
		// would false-red on its own rationale.
		const src = raw
			.replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */
			.replace(/<!--[\s\S]*?-->/g, ' ') // <!-- html -->
			.replace(/\/\/[^\n]*/g, ' '); // // line

		// (1) No hex literals.
		expect(src.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();

		// (2) No color functions.
		expect(
			src.match(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/gi)
		).toBeNull();

		// (3) No chromatic named colors. The (?<![\w-]) / (?![\w-]) fences keep
		// token names like --wired-black from tripping "black".
		expect(
			src.match(
				/(?<![\w-])(red|green|blue|orange|yellow|purple|pink|gray|grey|black|white|cyan|magenta|teal|navy|olive|maroon|silver|gold|crimson|hotpink)(?![\w-])/gi
			)
		).toBeNull();

		// (4) Every var(--…) must be a palette color or a --font-*/--space-* token.
		// No min-count guard (AC9): FilterStrip legitimately uses no color token.
		const tokens = [...src.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]);
		const allowedColors = [
			'--page-ink',
			'--caption-gray',
			'--link-blue',
			'--wired-black',
			'--paper-white',
			'--hairline-tint'
		];
		for (const t of tokens) {
			const ok = allowedColors.includes(t) || t.startsWith('--font-') || t.startsWith('--space-');
			expect(ok, `off-palette token ${t}`).toBe(true);
		}
	});
});
